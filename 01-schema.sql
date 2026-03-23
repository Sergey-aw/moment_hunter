-- 01-schema.sql
-- Core Supabase schema for the live event prediction MVP.

create extension if not exists pgcrypto;

-- Roles and match lifecycle enums.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('user', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum ('draft', 'upcoming', 'live', 'completed', 'cancelled');
  end if;
end $$;

-- Helper table for elevated permissions in RLS.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  stream_url text not null,
  status public.match_status not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  name text not null,
  prediction_window_sec integer not null check (prediction_window_sec between 1 and 300),
  created_at timestamptz not null default now(),
  unique (id, match_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  event_type_id uuid not null,
  official_ts timestamptz not null,
  created_by_admin uuid references auth.users(id),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, match_id),
  constraint fk_events_event_type_match
    foreign key (event_type_id, match_id)
    references public.event_types(id, match_id)
    on delete cascade
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  event_type_id uuid not null,
  predicted_ts timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fk_predictions_event_type_match
    foreign key (event_type_id, match_id)
    references public.event_types(id, match_id)
    on delete cascade
);

create table if not exists public.points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  event_type_id uuid not null references public.event_types(id) on delete cascade,
  delta_ms integer not null check (delta_ms >= 0),
  points_awarded integer not null check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

-- Performance indexes.
create index if not exists idx_matches_status_starts_at on public.matches(status, starts_at desc);
create index if not exists idx_event_types_match on public.event_types(match_id);
create index if not exists idx_events_match_type_ts on public.events(match_id, event_type_id, official_ts desc);
create index if not exists idx_predictions_match_type_ts on public.predictions(match_id, event_type_id, predicted_ts);
create index if not exists idx_predictions_user_created on public.predictions(user_id, created_at desc);
create index if not exists idx_points_log_match_points on public.points_log(match_id, points_awarded desc);
create index if not exists idx_points_log_user_created on public.points_log(user_id, created_at desc);

-- Keep updated_at current.
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.tg_touch_updated_at();

drop trigger if exists trg_matches_touch_updated_at on public.matches;
create trigger trg_matches_touch_updated_at
before update on public.matches
for each row
execute function public.tg_touch_updated_at();

-- Auto-create profile and default role for new auth users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username)
  values (new.id, nullif(new.raw_user_meta_data ->> 'username', ''))
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Ignore client-provided timestamps for fairness.
create or replace function public.tg_set_prediction_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.predicted_ts = now();
  return new;
end;
$$;

drop trigger if exists trg_predictions_set_timestamp on public.predictions;
create trigger trg_predictions_set_timestamp
before insert on public.predictions
for each row
execute function public.tg_set_prediction_timestamp();

-- RLS helper.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'admin'
  );
$$;

-- Core scoring function.
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

  update public.profiles pr
  set total_points = coalesce((
      select sum(pl.points_awarded)
      from public.points_log pl
      where pl.user_id = pr.user_id
    ), 0),
    updated_at = now();

  update public.events
  set settled_at = now()
  where id = p_event_id;
end;
$$;

-- Automatically settle points whenever an event is created or retimed.
create or replace function public.tg_settle_event_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.settle_event(new.id);
  return new;
end;
$$;

drop trigger if exists trg_events_settle_after_write on public.events;
create trigger trg_events_settle_after_write
after insert or update of official_ts on public.events
for each row
execute function public.tg_settle_event_after_write();

-- Leaderboard views.
create or replace view public.match_leaderboard_view as
select
  pl.match_id,
  pr.user_id,
  pr.username,
  pr.avatar_url,
  sum(pl.points_awarded)::int as points,
  rank() over (
    partition by pl.match_id
    order by sum(pl.points_awarded) desc, min(pl.created_at) asc
  ) as rank
from public.points_log pl
join public.profiles pr on pr.user_id = pl.user_id
group by pl.match_id, pr.user_id, pr.username, pr.avatar_url;

create or replace view public.global_leaderboard_view as
select
  pr.user_id,
  pr.username,
  pr.avatar_url,
  pr.total_points,
  rank() over (order by pr.total_points desc, pr.created_at asc) as rank
from public.profiles pr;
