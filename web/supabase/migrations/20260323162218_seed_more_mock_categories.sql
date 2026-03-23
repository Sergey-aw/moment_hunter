-- Seed additional mock matches across categories with event types.
-- Idempotent by title.

with target_matches as (
  select *
  from (
    values
      ('Premier League Mock: Arsenal vs Chelsea', 'football', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '1 day'),
      ('NBA Mock: Lakers vs Celtics', 'basketball', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '2 days'),
      ('NHL Mock: Rangers vs Bruins', 'hockey', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '3 days'),
      ('UFC Mock: Main Event', 'mma', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '4 days'),
      ('Dota 2 Mock: Team Spirit vs Tundra', 'esports-dota2', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'live', now() - interval '15 minutes'),
      ('League of Legends Mock: T1 vs G2', 'esports-lol', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'live', now() - interval '20 minutes'),
      ('Valorant Mock: Sentinels vs Fnatic', 'esports-valorant', 'https://www.youtube.com/embed/e_E9W2vsRbQ', 'live', now() - interval '10 minutes'),
      ('CS2 Mock: NAVI vs FaZe', 'esports-cs2', 'https://www.youtube.com/embed/ExZtISgOxEQ', 'live', now() - interval '8 minutes'),
      ('Formula 1 Mock: Bahrain GP', 'motorsport-f1', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '5 days'),
      ('Tennis Mock: Alcaraz vs Sinner', 'tennis', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '6 days'),
      ('Volleyball Mock: Poland vs Italy', 'volleyball', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '7 days'),
      ('Handball Mock: Denmark vs France', 'handball', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'upcoming', now() + interval '8 days'),
      ('Past Football Mock: Barca vs Real', 'football', 'https://www.youtube.com/watch?v=o3V-GvvzjE4', 'completed', now() - interval '10 days'),
      ('Past CS2 Mock: Vitality vs MOUZ', 'esports-cs2', 'https://www.youtube.com/embed/ExZtISgOxEQ', 'completed', now() - interval '14 days')
  ) as t(title, category, stream_url, status, starts_at)
), inserted as (
  insert into public.matches (title, category, stream_url, status, starts_at)
  select t.title, t.category, t.stream_url, t.status::public.match_status, t.starts_at
  from target_matches t
  where not exists (
    select 1 from public.matches m where m.title = t.title
  )
  returning id, title
), all_matches as (
  select id, title from inserted
  union all
  select m.id, m.title
  from public.matches m
  where m.title in (select title from target_matches)
)
insert into public.event_types (match_id, name, prediction_window_sec)
select am.id, e.name, e.prediction_window_sec
from all_matches am
join (
  values
    ('Premier League Mock: Arsenal vs Chelsea', 'Goal', 25),
    ('Premier League Mock: Arsenal vs Chelsea', 'Shot On Target', 12),

    ('NBA Mock: Lakers vs Celtics', 'Three Pointer', 15),
    ('NBA Mock: Lakers vs Celtics', 'Dunk', 10),

    ('NHL Mock: Rangers vs Bruins', 'Goal', 20),
    ('NHL Mock: Rangers vs Bruins', 'Power Play Goal', 25),

    ('UFC Mock: Main Event', 'Knockdown', 12),
    ('UFC Mock: Main Event', 'Submission Attempt', 10),

    ('Dota 2 Mock: Team Spirit vs Tundra', 'Kill', 15),
    ('Dota 2 Mock: Team Spirit vs Tundra', 'Roshan Kill', 20),

    ('League of Legends Mock: T1 vs G2', 'Kill', 15),
    ('League of Legends Mock: T1 vs G2', 'Tower Destroyed', 20),

    ('Valorant Mock: Sentinels vs Fnatic', 'Kill', 15),
    ('Valorant Mock: Sentinels vs Fnatic', 'Spike Plant', 12),

    ('CS2 Mock: NAVI vs FaZe', 'Headshot', 15),
    ('CS2 Mock: NAVI vs FaZe', 'Round Win', 30),

    ('Formula 1 Mock: Bahrain GP', 'Overtake', 12),
    ('Formula 1 Mock: Bahrain GP', 'Pit Stop', 15),

    ('Tennis Mock: Alcaraz vs Sinner', 'Ace', 8),
    ('Tennis Mock: Alcaraz vs Sinner', 'Break Point Won', 15),

    ('Volleyball Mock: Poland vs Italy', 'Ace', 8),
    ('Volleyball Mock: Poland vs Italy', 'Block Point', 10),

    ('Handball Mock: Denmark vs France', 'Goal', 12),
    ('Handball Mock: Denmark vs France', 'Fast Break Goal', 10),

    ('Past Football Mock: Barca vs Real', 'Goal', 25),
    ('Past Football Mock: Barca vs Real', 'Shot On Target', 12),

    ('Past CS2 Mock: Vitality vs MOUZ', 'Headshot', 15),
    ('Past CS2 Mock: Vitality vs MOUZ', 'Round Win', 30)
) as e(title, name, prediction_window_sec)
  on e.title = am.title
where not exists (
  select 1
  from public.event_types et
  where et.match_id = am.id
    and et.name = e.name
);
