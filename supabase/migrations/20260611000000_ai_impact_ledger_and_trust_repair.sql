-- ─────────────────────────────────────────────────────────────────────────────
-- AI Impact Ledger + Trust & Safety schema repair — 2026-06-11
--
-- 1. risk_flags: the live application code (admin/trust-safety page, the
--    /api/admin/trust/flags/[id]/resolve route, and the apply-schema tool)
--    reads/writes flag_type, description, resolved, resolved_by, resolved_at —
--    columns that were never added by the initial schema migration. Add them
--    and backfill flag_type from the legacy `code` column so the existing
--    Trust & Safety dashboard starts returning real data.
-- 2. admin_reviews: /api/admin/trust/reviews reads/writes an `action` column
--    that the initial schema never created. Add it.
-- 3. transparency_ledger_items: add AI summary / risk-review columns so the
--    Impact Ledger can be scored and gated by the new
--    /api/ai/impact-summary endpoint, and extend item_type to cover the
--    values the dashboard ledger UI already offers.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── risk_flags repair ─────────────────────────────────────────────────────────
alter table risk_flags
  add column if not exists flag_type text,
  add column if not exists description text,
  add column if not exists resolved boolean not null default false,
  add column if not exists resolved_by uuid references profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz;

update risk_flags set flag_type = code where flag_type is null;
alter table risk_flags alter column flag_type set not null;

alter table risk_flags drop constraint if exists risk_flags_severity_check;
alter table risk_flags add constraint risk_flags_severity_check
  check (severity in ('low','medium','high','critical'));

create index if not exists risk_flags_flag_type_idx on risk_flags(flag_type);
create index if not exists risk_flags_resolved_idx on risk_flags(resolved);

-- ── admin_reviews repair ──────────────────────────────────────────────────────
alter table admin_reviews
  add column if not exists action text;

alter table admin_reviews drop constraint if exists admin_reviews_action_check;
alter table admin_reviews add constraint admin_reviews_action_check
  check (action is null or action in ('approved','rejected','flagged','held','released'));

-- ── transparency_ledger_items: AI summary + review gating ───────────────────────
alter table transparency_ledger_items
  add column if not exists risk_score numeric,
  add column if not exists review_status text not null default 'auto_approved',
  add column if not exists reviewed_by uuid references profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists ai_generation_id uuid references ai_generations(id) on delete set null;

alter table transparency_ledger_items drop constraint if exists transparency_ledger_items_review_status_check;
alter table transparency_ledger_items add constraint transparency_ledger_items_review_status_check
  check (review_status in ('auto_approved','pending_review','approved','rejected'));

alter table transparency_ledger_items drop constraint if exists transparency_ledger_items_item_type_check;
alter table transparency_ledger_items add constraint transparency_ledger_items_item_type_check
  check (item_type in ('milestone','receipt','expense','payout','impact_update','offline_donation','other'));

create index if not exists ledger_review_status_idx on transparency_ledger_items(review_status);

-- ── transparency_ledger_items RLS: gate visibility on review_status ────────────
drop policy if exists ledger_public_read on transparency_ledger_items;
create policy ledger_public_read on transparency_ledger_items for select using (
  review_status in ('auto_approved','approved')
  or is_admin()
  or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid())
);

drop policy if exists ledger_owner_update on transparency_ledger_items;
create policy ledger_owner_update on transparency_ledger_items for update
  using (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()))
  with check (is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid()));

drop policy if exists ledger_owner_delete on transparency_ledger_items;
create policy ledger_owner_delete on transparency_ledger_items for delete using (
  is_admin() or exists (select 1 from campaigns where campaigns.id = campaign_id and campaigns.user_id = auth.uid())
);
