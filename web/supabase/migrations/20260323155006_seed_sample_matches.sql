-- Seed sample matches and event types for MVP demo.
-- Idempotent inserts to avoid duplicates on repeated db push.

with upsert_matches as (
  insert into public.matches (title, category, stream_url, status, starts_at)
  values
    (
      'VCT Live Example',
      'esports',
      'https://www.youtube.com/@ValorantEsports/live',
      'live',
      now() - interval '10 minutes'
    ),
    (
      'CS2 Live Example',
      'esports',
      'https://www.youtube.com/@ESLCS/live',
      'live',
      now() - interval '5 minutes'
    ),
    (
      'Football Goal Moment Example',
      'football',
      'https://www.youtube.com/watch?v=o3V-GvvzjE4',
      'upcoming',
      now() + interval '2 hours'
    )
  on conflict do nothing
  returning id, title
), all_target_matches as (
  select id, title from upsert_matches
  union all
  select m.id, m.title
  from public.matches m
  where m.title in ('VCT Live Example', 'CS2 Live Example', 'Football Goal Moment Example')
)
insert into public.event_types (match_id, name, prediction_window_sec)
select atm.id, et.name, et.prediction_window_sec
from all_target_matches atm
join (
  values
    ('VCT Live Example', 'Kill', 15),
    ('VCT Live Example', 'Clutch', 20),
    ('CS2 Live Example', 'Headshot', 15),
    ('CS2 Live Example', 'Round Win', 30),
    ('Football Goal Moment Example', 'Goal', 20),
    ('Football Goal Moment Example', 'Shot On Target', 12)
) as et(title, name, prediction_window_sec)
  on et.title = atm.title
where not exists (
  select 1
  from public.event_types existing
  where existing.match_id = atm.id
    and existing.name = et.name
);
