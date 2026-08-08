-- Rollback for 20260827000000_donations_columns_missing_from_migrations.sql
--
-- ⚠️ READ THIS BEFORE RUNNING IT ANYWHERE THAT HAS TAKEN A DONATION.
--
-- The forward migration is a no-op against the live database — all five columns
-- already exist there, which is the whole reason it was written. So running this
-- rollback against production does NOT undo a change this migration made; it
-- DELETES COLUMNS THAT PREDATE IT, and with them:
--
--   • every Stripe checkout session id on record, which is what
--     `record_donation` uses to recognise a redelivered webhook. Without it the
--     next duplicate delivery inserts a SECOND donation row and the campaign
--     total moves twice for one payment.
--   • every offline donation's method, donor name and donor email — cash and
--     cheque gifts recorded by hand, which exist in no Stripe account and are
--     not reconstructible from anywhere.
--
-- This file exists because every migration in this repo has a rollback, and a
-- missing one is worse than a documented dangerous one. It is the correct thing
-- to run on a scratch database that applied the migration by mistake. It is
-- close to the worst thing to run on production.
--
-- The index is dropped first and separately: dropping only the index is the
-- SAFE half of this rollback, and is all that is needed to undo the forward
-- migration's only real effect on an existing database.

drop index if exists public.donations_stripe_checkout_session_id_idx;

-- ── Destructive from here down. See the warning above. ───────────────────────

alter table if exists public.donations drop column if exists offline_donor_email;
alter table if exists public.donations drop column if exists offline_donor_name;
alter table if exists public.donations drop column if exists offline_method;
alter table if exists public.donations drop column if exists offline;
alter table if exists public.donations drop column if exists stripe_checkout_session_id;
