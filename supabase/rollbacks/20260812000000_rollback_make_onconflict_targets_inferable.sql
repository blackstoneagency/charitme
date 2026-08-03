-- Rollback for 20260812000000_make_onconflict_targets_inferable.sql
--
-- Drops the four unique indexes the migration added so `ON CONFLICT` could infer
-- an arbiter. Index-only: no rows are touched and no column is removed.
--
-- ⚠️ Reverting reinstates the upserts' inability to infer a conflict target, so
-- the same 42P10 class of failure returns on the payment-observability writes.
--
-- Index names measured with `scripts/diff-migration.sh 20260812000000`, not read
-- off the SQL — the migration builds several of these inside a DO block.

drop index if exists public.campaign_owner_transfers_processor_object_uidx;
drop index if exists public.campaign_payment_refunds_processor_object_uidx;
drop index if exists public.campaign_processor_fees_processor_object_uidx;
drop index if exists public.marketing_suppression_email_plain_uq;
