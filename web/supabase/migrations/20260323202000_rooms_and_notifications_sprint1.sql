-- Sprint 1: rooms, room predictions/leaderboard, and notification preferences.

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  invite_code text not null unique default upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_predictions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  predicted_ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.room_points_log (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  delta_ms integer not null check (delta_ms >= 0),
  points_awarded integer not null check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (room_id, user_id, event_id)
);

create table if not exists public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'push')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id, event_type_id, channel)
);

create index if not exists idx_rooms_owner_created on public.rooms(owner_user_id, created_at desc);
create index if not exists idx_rooms_match_created on public.rooms(match_id, created_at desc);
create index if not exists idx_room_members_user on public.room_members(user_id, joined_at desc);
create index if not exists idx_room_predictions_room_event on public.room_predictions(room_id, event_type_id, predicted_ts);
create index if not exists idx_room_points_room_points on public.room_points_log(room_id, points_awarded desc);
create index if not exists idx_notification_prefs_user_match on public.notification_prefs(user_id, match_id);

create or replace function public.tg_rooms_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_rooms_touch_updated_at on public.rooms;
create trigger trg_rooms_touch_updated_at
before update on public.rooms
for each row
execute function public.tg_rooms_set_updated_at();

drop trigger if exists trg_notification_prefs_touch_updated_at on public.notification_prefs;
create trigger trg_notification_prefs_touch_updated_at
before update on public.notification_prefs
for each row
execute function public.tg_rooms_set_updated_at();

create or replace function public.tg_room_predictions_set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.predicted_ts = now();
  return new;
end;
$$;

drop trigger if exists trg_room_predictions_set_timestamp on public.room_predictions;
create trigger trg_room_predictions_set_timestamp
before insert on public.room_predictions
for each row
execute function public.tg_room_predictions_set_timestamp();

create or replace function public.tg_rooms_add_owner_member()
returns trigger
language plpgsql
as $$
begin
  insert into public.room_members (room_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict (room_id, user_id) do update set role = excluded.role;

  return new;
end;
$$;

drop trigger if exists trg_rooms_add_owner_member on public.rooms;
create trigger trg_rooms_add_owner_member
after insert on public.rooms
for each row
execute function public.tg_rooms_add_owner_member();

create or replace function public.tg_validate_room_prediction()
returns trigger
language plpgsql
as $$
declare
  v_room_match_id uuid;
  v_match_category text;
  v_event_type_category text;
begin
  select r.match_id into v_room_match_id
  from public.rooms r
  where r.id = new.room_id;

  if v_room_match_id is null then
    raise exception 'Room % not found', new.room_id;
  end if;

  if v_room_match_id <> new.match_id then
    raise exception 'Room match mismatch for room %', new.room_id;
  end if;

  select m.category into v_match_category
  from public.matches m
  where m.id = new.match_id;

  select et.category into v_event_type_category
  from public.event_types et
  where et.id = new.event_type_id;

  if v_match_category is null or v_event_type_category is null then
    raise exception 'Invalid match/event type reference';
  end if;

  if v_match_category <> v_event_type_category then
    raise exception 'Event type category (%) does not match room match category (%)', v_event_type_category, v_match_category;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_room_predictions_validate on public.room_predictions;
create trigger trg_room_predictions_validate
before insert or update of room_id, match_id, event_type_id on public.room_predictions
for each row
execute function public.tg_validate_room_prediction();

create or replace function public.join_room(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select r.id, r.status
    into v_room
  from public.rooms r
  where upper(r.invite_code) = upper(trim(p_invite_code));

  if not found then
    raise exception 'Invite code not found';
  end if;

  if v_room.status <> 'open' then
    raise exception 'Room is closed';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (v_room.id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;

  return v_room.id;
end;
$$;

grant execute on function public.join_room(text) to authenticated;

create or replace view public.room_leaderboard_view as
with totals as (
  select
    rpl.room_id,
    rpl.user_id,
    sum(rpl.points_awarded)::int as points
  from public.room_points_log rpl
  group by rpl.room_id, rpl.user_id
)
select
  t.room_id,
  t.user_id,
  p.username,
  p.avatar_url,
  t.points,
  dense_rank() over (partition by t.room_id order by t.points desc, t.user_id) as rank
from totals t
left join public.profiles p
  on p.user_id = t.user_id;

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

  insert into public.room_points_log (
    room_id,
    user_id,
    match_id,
    event_id,
    event_type_id,
    delta_ms,
    points_awarded
  )
  select
    rp.room_id,
    rp.user_id,
    rp.match_id,
    v_event.id,
    v_event.event_type_id,
    abs(extract(epoch from (rp.predicted_ts - v_event.official_ts)) * 1000)::int as delta_ms,
    case
      when abs(extract(epoch from (rp.predicted_ts - v_event.official_ts)) * 1000)::int <= 1000 then 100
      when abs(extract(epoch from (rp.predicted_ts - v_event.official_ts)) * 1000)::int <= 3000 then 70
      when abs(extract(epoch from (rp.predicted_ts - v_event.official_ts)) * 1000)::int <= 5000 then 40
      when abs(extract(epoch from (rp.predicted_ts - v_event.official_ts)) * 1000)::int <= 10000 then 15
      else 0
    end as points_awarded
  from public.room_predictions rp
  join public.rooms r
    on r.id = rp.room_id
  where rp.match_id = v_event.match_id
    and rp.event_type_id = v_event.event_type_id
    and r.status = 'open'
    and rp.predicted_ts between (v_event.official_ts - make_interval(secs => v_event.prediction_window_sec))
                           and v_event.official_ts
  on conflict (room_id, user_id, event_id)
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

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_predictions enable row level security;
alter table public.room_points_log enable row level security;
alter table public.notification_prefs enable row level security;

alter table public.rooms force row level security;
alter table public.room_members force row level security;
alter table public.room_predictions force row level security;
alter table public.room_points_log force row level security;
alter table public.notification_prefs force row level security;

drop policy if exists "rooms_select_member_or_public" on public.rooms;
drop policy if exists "rooms_insert_owner" on public.rooms;
drop policy if exists "rooms_update_owner_or_admin" on public.rooms;
drop policy if exists "room_members_select_room_members" on public.room_members;
drop policy if exists "room_members_insert_self_or_owner" on public.room_members;
drop policy if exists "room_members_delete_self_or_owner" on public.room_members;
drop policy if exists "room_predictions_select_room_members" on public.room_predictions;
drop policy if exists "room_predictions_insert_own_for_room_member" on public.room_predictions;
drop policy if exists "room_points_log_select_room_members" on public.room_points_log;
drop policy if exists "notification_prefs_select_own" on public.notification_prefs;
drop policy if exists "notification_prefs_insert_own" on public.notification_prefs;
drop policy if exists "notification_prefs_update_own" on public.notification_prefs;

create policy "rooms_select_member_or_public"
on public.rooms
for select
to authenticated
using (
  visibility = 'public'
  or owner_user_id = auth.uid()
  or exists (
    select 1
    from public.room_members rm
    where rm.room_id = id
      and rm.user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "rooms_insert_owner"
on public.rooms
for insert
to authenticated
with check (owner_user_id = auth.uid() or public.is_admin());

create policy "rooms_update_owner_or_admin"
on public.rooms
for update
to authenticated
using (owner_user_id = auth.uid() or public.is_admin())
with check (owner_user_id = auth.uid() or public.is_admin());

create policy "room_members_select_room_members"
on public.room_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.room_members rm2
    where rm2.room_id = public.room_members.room_id
      and rm2.user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "room_members_insert_self_or_owner"
on public.room_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    where r.id = public.room_members.room_id
      and r.owner_user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "room_members_delete_self_or_owner"
on public.room_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.rooms r
    where r.id = public.room_members.room_id
      and r.owner_user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "room_predictions_select_room_members"
on public.room_predictions
for select
to authenticated
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = public.room_predictions.room_id
      and rm.user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "room_predictions_insert_own_for_room_member"
on public.room_predictions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.room_members rm
    join public.rooms r
      on r.id = rm.room_id
    join public.matches m
      on m.id = r.match_id
    where rm.room_id = public.room_predictions.room_id
      and rm.user_id = auth.uid()
      and r.status = 'open'
      and r.match_id = public.room_predictions.match_id
      and m.status = 'live'
  )
);

create policy "room_points_log_select_room_members"
on public.room_points_log
for select
to authenticated
using (
  exists (
    select 1
    from public.room_members rm
    where rm.room_id = public.room_points_log.room_id
      and rm.user_id = auth.uid()
  )
  or public.is_admin()
);

create policy "notification_prefs_select_own"
on public.notification_prefs
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notification_prefs_insert_own"
on public.notification_prefs
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

create policy "notification_prefs_update_own"
on public.notification_prefs
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

grant select on public.room_leaderboard_view to authenticated;
