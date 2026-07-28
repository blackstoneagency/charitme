-- Make every `upsert(..., { onConflict: ... })` target actually inferable.
--
-- `ON CONFLICT (cols)` is resolved by INFERENCE: Postgres needs a unique index or
-- constraint on exactly those columns. It will NOT use a partial index unless the
-- statement repeats the index predicate, and it will NOT use an expression index
-- unless the expression matches. supabase-js `onConflict` takes bare column names,
-- so neither is expressible — those upserts raise 42P10 and write nothing:
--
--   ERROR: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- Every one of these discarded its result, so the failures were invisible.
--
-- Dated last on purpose. An earlier draft sat at 20260728030000 and was silently
-- undone: 20260730000000_marketing_opportunities.sql re-creates
-- uq_marketing_opps_dedupe as a partial index, so it simply ran afterwards and
-- put the predicate back. Regenerating supabase/schema.sql is what caught that —
-- the mirror replays every migration in order, so it shows the state that
-- actually results rather than the one each file intends.
-- Companion to 20260728020000 (tax_receipts), found by the same check, which is
-- now pinned by apps/web/__tests__/upsert-onconflict-has-index.test.ts.
--
-- Note a plain UNIQUE is enough in all of these cases: NULLs are distinct under a
-- unique index (and a composite row containing a NULL never conflicts), so the
-- `where ... is not null` predicates were never what allowed the nullable rows.

-- ── 1. Payment reconciliation ledgers ───────────────────────────────────────
-- `20260608020000_campaign_payment_observability.sql` created four sibling
-- tables, all upserted on (processor, processor_object_id) as the webhook replay
-- key. Only `campaign_payment_disputes` ever got the constraint
-- (`campaign_payment_disputes_processor_processor_object_id_key`). The other
-- three had none at all, so every processor-fee, refund and owner-transfer row
-- the Stripe webhook tried to record was rejected.
--
-- Dedupe before building: without a constraint, duplicates were free to
-- accumulate. Keep the newest row per key, matching the reconciliation view,
-- which reads the latest state.

delete from public.campaign_processor_fees older
using public.campaign_processor_fees newer
where older.processor_object_id is not null
  and older.processor = newer.processor
  and older.processor_object_id = newer.processor_object_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists campaign_processor_fees_processor_object_uidx
  on public.campaign_processor_fees (processor, processor_object_id);

delete from public.campaign_payment_refunds older
using public.campaign_payment_refunds newer
where older.processor_object_id is not null
  and older.processor = newer.processor
  and older.processor_object_id = newer.processor_object_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists campaign_payment_refunds_processor_object_uidx
  on public.campaign_payment_refunds (processor, processor_object_id);

delete from public.campaign_owner_transfers older
using public.campaign_owner_transfers newer
where older.processor_object_id is not null
  and older.processor = newer.processor
  and older.processor_object_id = newer.processor_object_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists campaign_owner_transfers_processor_object_uidx
  on public.campaign_owner_transfers (processor, processor_object_id);

-- ── 2. Marketing opportunities ──────────────────────────────────────────────
-- Partial index; same shape as the tax_receipts case. The predicate bought
-- nothing and blocked inference, so the AI opportunity drafts were never saved.

drop index if exists public.uq_marketing_opps_dedupe;

create unique index if not exists uq_marketing_opps_dedupe
  on public.marketing_opportunities (dedupe_key);

-- ── 3. Email suppression list ───────────────────────────────────────────────
-- This one was BOTH partial and an EXPRESSION index — `unique (lower(email))
-- where email is not null` — against an `onConflict: 'email'`. So clicking
-- "unsubscribe" in a marketing email wrote nothing and the address kept
-- receiving mail. That is the one failure here with a compliance edge.
--
-- `unsubscribeEmail()` lowercases before writing, so a plain unique on `email`
-- is equivalent for every current caller. The lower(email) index is KEPT as
-- well: it is what actually enforces case-insensitivity if a future writer
-- forgets to normalize, and it guarantees no case-variant duplicates exist
-- today, so the plain index below can be built without a dedupe pass.

create unique index if not exists marketing_suppression_email_plain_uq
  on public.marketing_suppression_list (email);
