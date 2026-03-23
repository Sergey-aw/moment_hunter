-- 02-rls-policies.sql
-- Row Level Security policies for the live event prediction MVP.

-- Ensure RLS is enabled.
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.event_types enable row level security;
alter table public.events enable row level security;
alter table public.predictions enable row level security;
alter table public.points_log enable row level security;

-- Optional but recommended: force RLS for all roles except table owners/superusers.
-- Comment out if you rely heavily on table-owner sessions in SQL editor.
alter table public.user_roles force row level security;
alter table public.profiles force row level security;
alter table public.matches force row level security;
alter table public.event_types force row level security;
alter table public.events force row level security;
alter table public.predictions force row level security;
alter table public.points_log force row level security;

-- Clean re-runs.
drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
drop policy if exists "user_roles_admin_manage" on public.user_roles;

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "matches_select_all" on public.matches;
drop policy if exists "matches_admin_manage" on public.matches;

drop policy if exists "event_types_select_all" on public.event_types;
drop policy if exists "event_types_admin_manage" on public.event_types;

drop policy if exists "events_select_all" on public.events;
drop policy if exists "events_admin_manage" on public.events;

drop policy if exists "predictions_select_own" on public.predictions;
drop policy if exists "predictions_insert_own_live_match" on public.predictions;

drop policy if exists "points_log_select_all" on public.points_log;

-- user_roles
create policy "user_roles_select_own_or_admin"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "user_roles_admin_manage"
on public.user_roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- profiles
create policy "profiles_select_all"
on public.profiles
for select
to authenticated
using (true);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- matches
create policy "matches_select_all"
on public.matches
for select
to authenticated
using (true);

create policy "matches_admin_manage"
on public.matches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- event_types
create policy "event_types_select_all"
on public.event_types
for select
to authenticated
using (true);

create policy "event_types_admin_manage"
on public.event_types
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- events
create policy "events_select_all"
on public.events
for select
to authenticated
using (true);

create policy "events_admin_manage"
on public.events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- predictions
create policy "predictions_select_own"
on public.predictions
for select
to authenticated
using (user_id = auth.uid());

create policy "predictions_insert_own_live_match"
on public.predictions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.status = 'live'
  )
);

-- points_log
-- Public select is needed for leaderboard rendering via SQL views.
create policy "points_log_select_all"
on public.points_log
for select
to authenticated
using (true);

-- No direct writes for clients; points are written by security-definer function only.

-- Grants for views/RPC usage.
grant usage on schema public to authenticated;
grant select on public.match_leaderboard_view to authenticated;
grant select on public.global_leaderboard_view to authenticated;
grant execute on function public.settle_event(uuid) to authenticated;
