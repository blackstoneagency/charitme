-- The admin "send tax receipt" upsert could never work.
--
-- 20260726000000 added the right constraint for the wrong reason:
--
--   create unique index tax_receipts_donation_id_unique
--     on public.tax_receipts (donation_id)
--     where donation_id is not null;
--
-- `donation_id` is nullable, so the predicate looks like it is what permits
-- receipts that aren't tied to a donation. It isn't: a plain UNIQUE index
-- already treats NULLs as distinct, so multiple NULL rows are allowed either
-- way. The predicate adds nothing — and it costs the upsert.
--
-- Postgres will only infer a PARTIAL unique index for `ON CONFLICT (col)` when
-- the statement repeats the index predicate. PostgREST emits a bare
-- `ON CONFLICT (donation_id)` (supabase-js `onConflict` takes column names
-- only, with no way to attach a WHERE clause), so the arbiter never matched and
-- every call raised 42P10:
--
--   ERROR: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- Verified on Postgres 16: the bare form errors against the partial index,
-- succeeds once the predicate is repeated, and succeeds against a plain index —
-- which still accepts multiple NULL donation_ids.
--
-- The failure was invisible because the call discarded its result, so the route
-- emailed the donor an IRS receipt and reported ok while recording nothing.
--
-- Dropping the predicate keeps the semantics and makes the index inferable.
-- The dedupe from 20260726000000 already ran, so the plain index can be built
-- without repeating it.

drop index if exists public.tax_receipts_donation_id_unique;

create unique index if not exists tax_receipts_donation_id_unique
  on public.tax_receipts (donation_id);
