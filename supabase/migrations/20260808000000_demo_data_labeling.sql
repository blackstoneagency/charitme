-- ─────────────────────────────────────────────────────────────────────────────
-- CHAR-1402 (second half) — demo-data labelling.
--
-- Problem: roughly 500 seeded demo campaigns are live and nothing distinguishes
-- them from real ones. A donor browsing the site cannot tell which fundraisers
-- are real. (They cannot currently take money — demo campaigns have no connected
-- Stripe account, so the page renders "Donations open soon" instead of the donate
-- form — but that is a safety net, not a label.)
--
-- This migration is deliberately ADDITIVE AND INERT:
--   • adds `is_demo` (default false) to the seeded tables + a partial index;
--   • does NOT guess which existing rows are demo.
--
-- Why no automatic backfill: the seed generations use different slug shapes
-- (`seed-campaign-*` in supabase/seeds/01, `campaign-<n>-<hash>` in the batch
-- already live), so any single pattern is incomplete — and a wrong guess
-- mislabels a REAL fundraiser as fake, which is far worse than no label at all.
-- The backfill is therefore left as a reviewed, explicit statement (below) that
-- an operator runs after confirming the pattern matches only seeded rows.
--
-- Safe to apply to production: adding a defaulted boolean rewrites no rows on
-- PostgreSQL 11+, and every read path ignores the column until someone opts in.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.campaigns
  add column if not exists is_demo boolean not null default false;

alter table if exists public.donations
  add column if not exists is_demo boolean not null default false;

alter table if exists public.profiles
  add column if not exists is_demo boolean not null default false;

-- Partial indexes: demo rows are the small minority, and the common query is
-- "exclude demo", so indexing only the true rows keeps these tiny.
create index if not exists campaigns_is_demo_idx on public.campaigns (is_demo) where is_demo;
create index if not exists donations_is_demo_idx on public.donations (is_demo) where is_demo;
create index if not exists profiles_is_demo_idx  on public.profiles  (is_demo) where is_demo;

comment on column public.campaigns.is_demo is
  'True for seeded/demo rows. Set explicitly by an operator — never auto-inferred, because a wrong guess would mark a real fundraiser as fake.';

-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL — NOT run by this migration. Review, then run by hand.
--
-- 1. Inspect first. Confirm the count and a sample look like seed data ONLY:
--
--      select count(*), min(slug), max(slug)
--        from public.campaigns
--       where slug like 'seed-campaign-%'
--          or slug ~ '^campaign-[0-9]+-[0-9a-f]{8}$';
--
-- 2. Only if that is exclusively seed data, label it:
--
--      update public.campaigns set is_demo = true
--       where slug like 'seed-campaign-%'
--          or slug ~ '^campaign-[0-9]+-[0-9a-f]{8}$';
--
--      update public.donations d set is_demo = true
--        from public.campaigns c
--       where d.campaign_id = c.id and c.is_demo;
--
-- 3. Verify nothing with a real Stripe payment got labelled:
--
--      select count(*) from public.donations
--       where is_demo and stripe_payment_intent_id is not null;   -- expect 0
-- ─────────────────────────────────────────────────────────────────────────────
