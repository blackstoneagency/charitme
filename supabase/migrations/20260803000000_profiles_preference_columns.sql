-- ─────────────────────────────────────────────────────────────────────────────
-- profiles: preference columns that exist in the live database but in no migration.
--
-- These seven columns are read AND written by /api/settings and selected by
-- app/dashboard/settings/page.tsx, and the schema-contract test (which validates
-- every `.from(table).select()` against a snapshot taken from the live database)
-- passes — so they are demonstrably present in production. They were never added
-- by a migration, though, so they are absent from supabase/schema.sql and
-- supabase/catch_up.sql, both of which are generated FROM supabase/migrations/
-- by scripts/regen_schema.sh and scripts/build_catchup.py.
--
-- The consequence: provisioning a fresh database from the migrations (or from the
-- generated schema.sql) produced a `profiles` table with 12 columns, and the whole
-- Preferences tab of Settings failed against it while working fine in production.
--
-- Every statement is `add column if not exists`, so this is a no-op against the
-- live database and only takes effect on a fresh provision. Columns are nullable
-- with defaults rather than NOT NULL: the application already supplies its own
-- fallbacks (`initialProfile.language ?? 'en'`), and NOT NULL would risk failing
-- against existing rows.
--
-- Defaults mirror the fallbacks the app uses, so a fresh database behaves the same
-- as production.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.profiles
  add column if not exists timezone text default 'America/New_York';

alter table if exists public.profiles
  add column if not exists currency text default 'usd';

alter table if exists public.profiles
  add column if not exists language text default 'en';

alter table if exists public.profiles
  add column if not exists date_format text default 'MM/DD/YYYY';

alter table if exists public.profiles
  add column if not exists time_format text default '12h';

alter table if exists public.profiles
  add column if not exists show_public_profile boolean default true;

alter table if exists public.profiles
  add column if not exists campaign_recommendations boolean default true;
