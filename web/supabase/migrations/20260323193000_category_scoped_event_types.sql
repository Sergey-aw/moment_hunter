-- Move event types from match scope to category scope.
-- Keeps historical rows valid by remapping duplicate event_type ids.

-- 1) Prepare category on event_types from the match it originally belonged to.
alter table public.event_types
  add column if not exists category text;

update public.event_types et
set category = m.category
from public.matches m
where m.id = et.match_id
  and (et.category is null or et.category = '');

alter table public.event_types
  alter column category set not null;

-- 2) Canonicalize duplicated event types inside the same category/name.
create temp table tmp_event_type_canonical as
select
  (array_agg(et.id order by et.id))[1] as canonical_id,
  et.category,
  et.name,
  max(et.prediction_window_sec) as canonical_prediction_window_sec
from public.event_types et
group by et.category, et.name;

create temp table tmp_event_type_id_map as
select
  et.id as old_id,
  c.canonical_id as new_id
from public.event_types et
join tmp_event_type_canonical c
  on c.category = et.category
 and c.name = et.name;

update public.event_types et
set prediction_window_sec = c.canonical_prediction_window_sec
from tmp_event_type_canonical c
where et.id = c.canonical_id
  and et.prediction_window_sec <> c.canonical_prediction_window_sec;

update public.predictions p
set event_type_id = map.new_id
from tmp_event_type_id_map map
where p.event_type_id = map.old_id
  and p.event_type_id <> map.new_id;

update public.events e
set event_type_id = map.new_id
from tmp_event_type_id_map map
where e.event_type_id = map.old_id
  and e.event_type_id <> map.new_id;

update public.points_log pl
set event_type_id = map.new_id
from tmp_event_type_id_map map
where pl.event_type_id = map.old_id
  and pl.event_type_id <> map.new_id;

-- Remove now-duplicated rows after remapping references.
delete from public.event_types et
where not exists (
  select 1
  from tmp_event_type_canonical c
  where c.canonical_id = et.id
);

-- 3) Drop old match-scoped constraints/shape.
drop index if exists public.idx_event_types_match;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'events'
      and constraint_name = 'fk_events_event_type_match'
  ) then
    alter table public.events
      drop constraint fk_events_event_type_match;
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'predictions'
      and constraint_name = 'fk_predictions_event_type_match'
  ) then
    alter table public.predictions
      drop constraint fk_predictions_event_type_match;
  end if;
end $$;

-- 4) Replace helper objects that depended on match-scoped event types
-- before dropping event_types.match_id.
create or replace function public.settle_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
begin
  select e.id,
         e.match_id,
         e.event_type_id,
         e.official_ts,
         et.prediction_window_sec
    into v_event
  from public.events e
  join public.event_types et
    on et.id = e.event_type_id
  where e.id = p_event_id;

  if not found then
    raise exception 'Event % not found', p_event_id;
  end if;

  insert into public.points_log (
    user_id,
    match_id,
    event_id,
    event_type_id,
    delta_ms,
    points_awarded
  )
  select
    p.user_id,
    p.match_id,
    v_event.id,
    v_event.event_type_id,
    abs(extract(epoch from (p.predicted_ts - v_event.official_ts)) * 1000)::int as delta_ms,
    case
      when abs(extract(epoch from (p.predicted_ts - v_event.official_ts)) * 1000)::int <= 1000 then 100
      when abs(extract(epoch from (p.predicted_ts - v_event.official_ts)) * 1000)::int <= 3000 then 70
      when abs(extract(epoch from (p.predicted_ts - v_event.official_ts)) * 1000)::int <= 5000 then 40
      when abs(extract(epoch from (p.predicted_ts - v_event.official_ts)) * 1000)::int <= 10000 then 15
      else 0
    end as points_awarded
  from public.predictions p
  where p.match_id = v_event.match_id
    and p.event_type_id = v_event.event_type_id
    and p.predicted_ts between (v_event.official_ts - make_interval(secs => v_event.prediction_window_sec))
                          and v_event.official_ts
  on conflict (user_id, event_id)
  do update set
    delta_ms = excluded.delta_ms,
    points_awarded = excluded.points_awarded,
    created_at = now();

  update public.profiles pr
  set total_points = totals.total_points,
      updated_at = now()
  from (
    select pl.user_id, coalesce(sum(pl.points_awarded), 0)::int as total_points
    from public.points_log pl
    where pl.user_id in (
      select distinct p.user_id
      from public.predictions p
      where p.match_id = v_event.match_id
        and p.event_type_id = v_event.event_type_id
    )
    group by pl.user_id
  ) as totals
  where pr.user_id = totals.user_id;

  update public.events
  set settled_at = now()
  where id = p_event_id;
end;
$$;

create or replace function public.simulate_event(
  p_match_id uuid,
  p_event_type_id uuid,
  p_offset_sec integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_exists boolean;
begin
  select exists (
    select 1
    from public.matches m
    join public.event_types et
      on et.category = m.category
    where m.id = p_match_id
      and et.id = p_event_type_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Event type % does not belong to match category for %', p_event_type_id, p_match_id;
  end if;

  insert into public.events (
    match_id,
    event_type_id,
    official_ts,
    created_by_admin
  )
  values (
    p_match_id,
    p_event_type_id,
    now() + make_interval(secs => greatest(p_offset_sec, 0)),
    auth.uid()
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

alter table public.event_types
  drop constraint if exists event_types_id_match_id_key;

alter table public.event_types
  drop column if exists match_id;

alter table public.event_types
  add constraint uq_event_types_category_name unique (category, name);

create index if not exists idx_event_types_category on public.event_types(category);

-- 4) Recreate FK links to global event_type id.
alter table public.events
  add constraint fk_events_event_type
  foreign key (event_type_id)
  references public.event_types(id)
  on delete cascade;

alter table public.predictions
  add constraint fk_predictions_event_type
  foreign key (event_type_id)
  references public.event_types(id)
  on delete cascade;

-- 5) Enforce that selected event type matches the match category.
create or replace function public.tg_validate_match_event_type_category()
returns trigger
language plpgsql
as $$
declare
  v_match_category text;
  v_event_type_category text;
begin
  select m.category into v_match_category
  from public.matches m
  where m.id = new.match_id;

  if v_match_category is null then
    raise exception 'Match % not found', new.match_id;
  end if;

  select et.category into v_event_type_category
  from public.event_types et
  where et.id = new.event_type_id;

  if v_event_type_category is null then
    raise exception 'Event type % not found', new.event_type_id;
  end if;

  if v_event_type_category <> v_match_category then
    raise exception 'Event type category (%) does not match match category (%)', v_event_type_category, v_match_category;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_events_validate_event_type_category on public.events;
create trigger trg_events_validate_event_type_category
before insert or update of match_id, event_type_id on public.events
for each row
execute function public.tg_validate_match_event_type_category();

drop trigger if exists trg_predictions_validate_event_type_category on public.predictions;
create trigger trg_predictions_validate_event_type_category
before insert or update of match_id, event_type_id on public.predictions
for each row
execute function public.tg_validate_match_event_type_category();

-- 6) Query surface for category-based event types per match.
create or replace view public.match_event_types as
select
  m.id as match_id,
  et.id,
  et.category,
  et.name,
  et.prediction_window_sec,
  et.created_at
from public.matches m
join public.event_types et
  on et.category = m.category;

grant select on public.match_event_types to authenticated;
