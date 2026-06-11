-- ─────────────────────────────────────────────────────────────────────────────
-- AI Payout Concierge + payouts schema repair — 2026-06-11
--
-- POST /api/payouts inserts `note` and updates `stripe_transfer_id` on the
-- payouts table, but the initial schema never created either column —
-- every payout request currently fails at the database layer. Add both
-- columns so the existing "Request Payout" flow works.
-- ─────────────────────────────────────────────────────────────────────────────

alter table payouts
  add column if not exists note text,
  add column if not exists stripe_transfer_id text;

create index if not exists payouts_stripe_transfer_id_idx on payouts(stripe_transfer_id);
