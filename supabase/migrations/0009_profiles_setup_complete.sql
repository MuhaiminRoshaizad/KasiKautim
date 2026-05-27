-- 0009_profiles_setup_complete.sql
--
-- Adds a setup_complete boolean to profiles to gate the welcome flow.
-- New Google-OAuth signups land on /dashboard/welcome where they
-- confirm their display name (pre-filled from Google) and set their
-- DuitNow ID. After save, setup_complete flips true and they never
-- see /welcome again.
--
-- Backfill: existing rows are set to true so users already using the
-- app don't get yanked back into the onboarding flow. The duitnow_id
-- banner on /dashboard still surfaces if they haven't configured it
-- (separate signal).

alter table public.profiles
  add column if not exists setup_complete boolean not null default false;

-- Existing users opt out of the welcome gate.
update public.profiles set setup_complete = true where setup_complete = false;
