-- ─────────────────────────────────────────────────────────────────────────────
-- Add the reviewer-tracking columns the refund-request workflow assumes.
--
-- `GET /api/admin/refunds` selects `reviewed_by, updated_at` and the PATCH handler
-- writes both, but neither column ever existed on `refunds` (the status enum has
-- under_review/approved/declined states, so a reviewer + updated_at were clearly
-- intended — the migration adding them was just never written). Selecting a
-- non-existent column makes PostgREST error the whole query, so the admin refunds
-- list returned nothing and status updates failed.
--
-- Purely additive (add column if not exists) — no data loss.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.refunds
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;

alter table if exists public.refunds
  add column if not exists updated_at timestamptz not null default now();
