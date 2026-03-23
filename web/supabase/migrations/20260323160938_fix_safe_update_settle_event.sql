-- Fix settle_event for environments enforcing safe updates (require WHERE clause).

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
   and et.match_id = e.match_id
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

  -- Update only affected users, avoids UPDATE without WHERE.
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
