-- Rollback for 20260728020000_fix_tax_receipt_upsert_inference.sql
--
-- ⚠️ THIS RESTORES A KNOWN BUG. Reverting is legitimate — this is what the
-- migration did in reverse — but be clear about what it reinstates.
--
-- The migration swapped a PARTIAL unique index for a plain one under the SAME
-- NAME (which is why a schema diff shows nothing added or removed). Postgres
-- only infers a partial unique index for `ON CONFLICT (col)` when the statement
-- repeats the predicate, and PostgREST emits a bare `ON CONFLICT (donation_id)`
-- because supabase-js `onConflict` takes column names only. So with the partial
-- index back, the admin "send tax receipt" upsert raises 42P10 again — and the
-- route discards its result, so it emails the donor an IRS receipt and reports
-- ok while recording nothing.
--
-- No data is lost either way: both forms are unique on donation_id, and a plain
-- unique index already treats NULLs as distinct, so the predicate never bought
-- the "receipts not tied to a donation" behaviour it appeared to.

drop index if exists public.tax_receipts_donation_id_unique;

create unique index if not exists tax_receipts_donation_id_unique
  on public.tax_receipts (donation_id)
  where donation_id is not null;
