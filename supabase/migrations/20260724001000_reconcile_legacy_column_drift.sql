-- ─────────────────────────────────────────────────────────────────────────────
-- Legacy column-drift reconciliation (LB-001)
--
-- The live database was created from an old schema snapshot, so some tables that
-- predate the nonprofit CRM features are missing columns that later migrations
-- (esp. 20260525002000_competitor_parity_features) assume exist. Those
-- migrations reference `nonprofit_id` in indexes/policies on EXISTING tables and
-- fail with 42703, rolling back all of their table creation.
--
-- This migration adds the missing columns idempotently so the feature migrations
-- can roll forward. Purely additive (add column if not exists) — no drops, no
-- data loss. Safe on clean and existing databases.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.donor_crm_contacts
  add column if not exists nonprofit_id uuid references public.nonprofit_profiles(id) on delete cascade;

alter table if exists public.recurring_donations
  add column if not exists nonprofit_id uuid references public.nonprofit_profiles(id) on delete cascade;
