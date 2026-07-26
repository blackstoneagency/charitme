-- ─────────────────────────────────────────────────────────────────────────────
-- profiles: the remaining columns that exist live but in no migration.
--
-- Completes 20260803000000_profiles_preference_columns.sql. That migration
-- restored the seven *preference* columns; this one covers the seven that were
-- still missing, found by diffing the live-database column snapshot
-- (__tests__/fixtures/schema-columns.json, 26 columns) against schema.sql (12)
-- plus that migration (7).
--
-- These are not incidental — they back two whole panels of Settings:
--   bio / org_name / org_tagline / org_website  → Profile & Organization,
--       written by saveProfile() via PATCH /api/settings
--   plan                                        → the plan chip and campaign limit
--   stripe_customer_id / stripe_subscription_id → Billing & Subscription, and the
--       `hasStripeCustomer` prop that decides whether the Stripe portal button or
--       an "Add method" link renders
--
-- So a database provisioned from the migrations alone lost profile editing and
-- billing as well as preferences.
--
-- As before: every statement is `add column if not exists`, making this a no-op
-- against the live database and effective only on a fresh provision. Columns are
-- nullable, matching how the app reads them (`initialProfile.bio ?? ''`,
-- `plan ?? 'free'`). `plan` carries a 'free' default so a new row lands on the
-- same tier PLAN_LABELS treats as the baseline.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.profiles
  add column if not exists bio text;

alter table if exists public.profiles
  add column if not exists org_name text;

alter table if exists public.profiles
  add column if not exists org_tagline text;

alter table if exists public.profiles
  add column if not exists org_website text;

alter table if exists public.profiles
  add column if not exists plan text default 'free';

alter table if exists public.profiles
  add column if not exists stripe_customer_id text;

alter table if exists public.profiles
  add column if not exists stripe_subscription_id text;
