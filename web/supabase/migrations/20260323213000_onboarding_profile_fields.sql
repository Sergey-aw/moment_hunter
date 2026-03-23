-- Add onboarding state and answers to profiles.

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists favorite_categories text[] not null default '{}',
  add column if not exists onboarding_goal text;

alter table public.profiles
  drop constraint if exists profiles_onboarding_goal_check;

alter table public.profiles
  add constraint profiles_onboarding_goal_check
  check (onboarding_goal is null or onboarding_goal in ('casual', 'competitive', 'creator'));

-- Keep existing users unblocked after rollout.
update public.profiles
set onboarding_completed = true,
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed = false;
