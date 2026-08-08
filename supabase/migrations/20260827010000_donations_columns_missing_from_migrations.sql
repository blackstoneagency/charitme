-- ─────────────────────────────────────────────────────────────────────────────
-- donations: the five columns that exist live but in no migration.
--
-- ⚠️ This one is not cosmetic drift. A database provisioned from
-- `supabase/migrations/` alone CANNOT ACCEPT A DONATION, and cannot report the
-- ones it did take. Both failures are in the money path:
--
--   1. `record_donation` — the single RPC every Stripe donation goes through —
--      reads and writes `donations.stripe_checkout_session_id`:
--
--        select id into v_existing from donations
--        where stripe_checkout_session_id = p_stripe_checkout_session_id ...
--        insert into donations (..., stripe_checkout_session_id, ...)
--
--      No migration creates that column. On a fresh provision the function
--      raises 42703 on its first statement, its own handler re-raises after
--      logging to webhook_events, and Stripe retries the delivery forever. The
--      donor is charged; the campaign is never credited.
--
--   2. `lib/reconciliation.ts` and `lib/pricing-analytics.ts` both filter
--      `.eq('offline', false)` to mean "came through Stripe". `record_donation`
--      does not set `offline`, so the column MUST default to false and be NOT
--      NULL — a nullable column leaves every online donation at NULL, `.eq(...,
--      false)` excludes NULL, and both surfaces report zero donations while the
--      table is full of them. That is why the definition below is
--      `not null default false` rather than a bare boolean: it is derived from
--      the two readers, not chosen.
--
-- Types come from the code that reads and writes each column, not from a guess:
--   stripe_checkout_session_id  text     — `record_donation(p_stripe_checkout_session_id text)`,
--                                          and the identically-named text column
--                                          on donation_receipts
--   offline                     boolean  — inserted as `offline: true` by
--                                          POST /api/offline-donations; filtered
--                                          as `.eq('offline', false)` above
--   offline_method              text     — `offline_method: method`, same insert
--   offline_donor_name          text     — rendered on /donor-wall and /community
--   offline_donor_email         text     — read by the admin receipt route
--
-- Every statement is `add column if not exists`, so this is a no-op against the
-- live database (which already has all five) and effective only on a fresh
-- provision. That is the entire point: it changes nothing today and makes
-- disaster recovery possible tomorrow.
--
-- The index is NOT unique, deliberately. `donations_stripe_payment_intent_id_uidx`
-- is unique and the symmetry is tempting, but record_donation already serialises
-- on `pg_advisory_xact_lock` keyed by intent-then-session id, so uniqueness is
-- not what makes it idempotent — the lock is. A unique index would instead be a
-- new constraint the owner's existing rows have never been checked against, and
-- would fail the migration outright on any historical duplicate. A plain index
-- gives the lookup its index scan and cannot reject data production accepted.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.donations
  add column if not exists stripe_checkout_session_id text;

alter table if exists public.donations
  add column if not exists offline boolean not null default false;

alter table if exists public.donations
  add column if not exists offline_method text;

alter table if exists public.donations
  add column if not exists offline_donor_name text;

alter table if exists public.donations
  add column if not exists offline_donor_email text;

-- Supports record_donation's idempotency lookup and the webhook's
-- `.eq('stripe_checkout_session_id', ...)` reconciliation queries.
create index if not exists donations_stripe_checkout_session_id_idx
  on public.donations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
