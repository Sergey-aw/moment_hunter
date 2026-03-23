-- Persist welcome tour completion per user.

alter table public.profiles
  add column if not exists welcome_tour_completed boolean not null default false,
  add column if not exists welcome_tour_completed_at timestamptz;

-- Existing users should not be blocked by the new tour.
update public.profiles
set welcome_tour_completed = true,
    welcome_tour_completed_at = coalesce(welcome_tour_completed_at, now())
where onboarding_completed = true
  and welcome_tour_completed = false;
