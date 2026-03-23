-- Fix sample stream URLs to embed-compatible links and add test simulation RPC.

-- Update seeded example matches to direct embed URLs.
update public.matches
set stream_url = 'https://www.youtube.com/embed/e_E9W2vsRbQ'
where title = 'VCT Live Example';

update public.matches
set stream_url = 'https://www.youtube.com/embed/ExZtISgOxEQ'
where title = 'CS2 Live Example';

-- Test helper: create official event at current/offset time and trigger settlement.
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
    from public.event_types et
    where et.id = p_event_type_id
      and et.match_id = p_match_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Event type % does not belong to match %', p_event_type_id, p_match_id;
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

grant execute on function public.simulate_event(uuid, uuid, integer) to authenticated;
