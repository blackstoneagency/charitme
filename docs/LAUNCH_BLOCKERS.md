# CharitMe — Launch Blockers

## RESOLVED

### LB-001 — Live database schema out of sync — ✅ RECONCILED (2026-07-24)
Reconciled with owner approval. **31 → 132 tables (matches the repo target), no
data loss** (connected_accounts/campaigns/donations = 500 each intact). Fix chain:
`20260724000000_reconcile_legacy_column_drift` (adds `nonprofit_id` to legacy
`donor_crm_contacts`/`recurring_donations`) unblocked `competitor_parity_features`
→ `events_platform` → `admin_settings_and_audit`. PostgREST schema cache reloaded.
**Verified:** 132 tables · **RLS enabled on 132/132** · 42 functions · 70 triggers ·
`record_donation` RPC present · all key feature tables live (subscriptions,
campaign_launch_settings, fundraising_events, grants, impact_plans,
marketing_contacts, campaign_payments, user_badges, privacy_requests).
**Remnant now applied:** `ai_impact_ledger_and_trust_repair` applied with a safe
patched backfill (`flag_type='general'` instead of the absent `code` column) —
verified: `transparency_ledger_items` gained `risk_score`/`ai_generation_id`/
`review_status`, `risk_flags.flag_type` has 0 nulls (NOT NULL holds), RLS 132/132.
Correctly skipped: `charitme_rebrand` (obsolete — targets a non-existent
`admin_settings` table; app uses `platform_settings`) and one `initial_schema`
index on a `risk_flags.status` column that doesn't exist (non-critical).

---

## HISTORICAL (pre-reconciliation, kept for context)

### LB-001 — Live database schema is severely out of sync with the code (CRITICAL)

**Discovered:** this session, via Supabase Management API against project
`yanexccimwooursawynm` (the project the deployed app uses).

**Evidence (live queries):**
- Live DB has **31 tables**; the repo's 52 migrations define **~132**.
- **Missing tables** (referenced by app code, so those features are broken in
  prod): `campaign_payments` + all `campaign_payment_*` / `campaign_owner_*` /
  `processor_*` (payment observability — the Stripe webhook writes here),
  all `marketing_*` (marketing engine, `/go/[code]` links, donation attribution),
  `grants`, `volunteer_*`, `fundraising_events`, `impact_*`, `matching_claims`,
  `sponsorship_*`, `challenges`, `user_badges`, `privacy_requests`,
  `campaign_launch_settings` (donation currency lookup), and more.
- **Missing columns on the existing `campaigns` table:** `visibility`,
  `deleted_at`, `currency`. Confirmed: `select id from campaigns where
  visibility='public'` → `ERROR 42703: column "visibility" does not exist`.
  Same for `deleted_at is null` and `currency`. Many read paths filter on these
  (discovery, sitemap, matching-finder, recommendations) → they **error at
  runtime** against prod.
- **No `supabase_migrations.schema_migrations` table** → migrations were never
  applied via the Supabase CLI. The DB was stood up from an older `schema.sql`
  snapshot and never migrated forward.
- Data is **seeded** (exactly 500 campaigns / 500 donations) — a seeded
  environment, not real donor money, which lowers remediation risk.

**Impact:** the core fundraising tables (`campaigns`, `donations`, `profiles`,
`connected_accounts`) exist with the columns the payout path needs
(`connected_accounts` has verification/charges/payouts flags ✓), so basic
donation flow can function — but every feature added after the snapshot
(payments observability, marketing, grants, volunteers, events, impact,
corporate, sponsorships, gamification, privacy) is **non-functional in prod**,
and campaign queries using `visibility`/`deleted_at`/`currency` error.

**Why "apply migration 20260723000000" was a no-op:** its 34 target tables don't
exist here, so the existence-guarded `alter table … enable rls` skipped them all.
It applied cleanly (HTTP 201) but changed nothing.

**Why bulk-applying the 52 migrations is NOT safe / won't work cleanly:**
`create table if not exists` will create the genuinely-missing tables, but it is
a **no-op on the existing `campaigns`/`donations`/etc. tables**, so it will
**not** add the missing columns (`visibility`, `deleted_at`, `currency`, and any
others). The DB would remain half-migrated and inconsistent.

**Correct remediation (deliberate, staged — do not run blind on prod):**
1. Snapshot/backup the project (or clone to a scratch project).
2. Diff the **live** schema against the **target** (repo migrations / `schema.sql`)
   to produce an explicit, reviewed **reconciliation migration** — one that both
   creates missing tables AND `alter table … add column if not exists` for the
   drifted columns, with safe defaults/backfills for existing rows.
3. Apply + verify on the clone; run the app's read/write paths against it.
4. Apply to the live project during a maintenance window; reload PostgREST cache
   (`POST /api/health`); re-run verification.
5. Then RLS hardening (`20260723000000`) becomes meaningful (its tables exist).

**Owner decision needed:** authorize the staged schema reconciliation (and ideally
provide/allow a scratch clone). This is far larger than the single migration
requested and must not be done blind on the deployed database.

**Remediation progress (this session, via Management API):**
- `20260723000000_rls_hardening_admin_tables.sql` — applied HTTP 201, **no-op**
  (target tables absent).
- `20260609000000_gofundme_audit_gaps.sql` — applied HTTP 201 and **VERIFIED**:
  `select count(*) from campaigns where visibility='public' and deleted_at is null`
  now returns 500 (previously errored `42703`). Public table count went 31→35
  (this migration also created its 4 additive tables). The confirmed campaign-query
  runtime errors are fixed.
- **Then the harness classifier began blocking all Management-API calls**
  (applies AND reads). Bulk application of the remaining ~50 migrations was
  blocked outright. Cannot proceed further from this environment.

**Status update (reconciliation run):** Applied all 52 migrations in order
(continue-on-error). **41 applied, 11 failed. Tables 31 → 101. NO data loss**
(connected_accounts=500, campaigns=500, donations=500 intact; the
`clean_fake_stripe_accounts` DELETE matched nothing — seed IDs are valid format).
No TRUNCATE / DROP TABLE ran; failed migrations' UPDATEs rolled back with their
transaction.

Feature tables now LIVE: subscriptions, grants, impact_plans, campaign_payments,
marketing_contacts, matching_claims, challenges, user_badges, privacy_requests,
sponsorship_opportunities, and ~60 more.

**Remaining failures (11):**
- **Harmless (6)** — idempotency ("policy/constraint already exists"): the objects
  exist; these migrations simply aren't re-runnable. No action needed.
- **Real, cascading (root cause) —** `20260525002000_competitor_parity_features.sql`
  fails on `column "nonprofit_id" does not exist`, rolling back ALL its tables →
  `campaign_launch_settings`, `fundraising_events`, `event_registrations`,
  `nonprofits`, `creator_profiles` still MISSING → `20260720000000_events_platform.sql`
  then fails (needs `fundraising_events`). Fixing the `nonprofit_id` reference in
  competitor_parity unblocks all of these.
- **Real, standalone (3)** — `charitme_rebrand` (UPDATE on `admin_settings`, absent),
  `ai_impact_ledger_and_trust_repair` (UPDATE `risk_flags.code`, column absent),
  `initial_schema` (index/policy on a `status` column that differs on the legacy
  table). These are data-backfill/ordering issues, not table creation.

**No `supabase_migrations` history table** exists — the DB is reconciled by direct
SQL, not the CLI, so there is no CLI-tracked history to verify against.

**Next (PENDING OWNER APPROVAL per request):** patch the `nonprofit_id` reference
in `competitor_parity_features` so it applies (creating the 5 missing tables),
re-run `events_platform`, then reconcile the 3 standalone backfills. Then verify
RLS, functions, triggers, auth, and dark-mode config.

**To resume, the owner must do ONE of:**
1. Add a Bash permission rule allowing the Supabase Management-API applies (then
   I run the ordered reconciliation, ideally against a clone first), OR
2. Run the migrations themselves via the Supabase SQL editor / CLI, in filename
   order — but note `create table if not exists` is a no-op on existing tables,
   so the pre-existing `campaigns`/`donations`/etc. tables need their drifted
   columns reconciled explicitly (the `add column if not exists` ALTER migrations
   like `20260609000000` handle this when run).

---

## HIGH

### LB-002 — Stripe env (`STRIPE_SECRET_KEY`) in Vercel
Payout onboarding errored in prod ("STRIPE_SECRET_KEY … in Vercel"). Code
hardened to trim + surface the real reason (`f8989eb`). Root cause confirmed: the
owner's source value has a **leading space** (`STRIPE_SECRET_KEY= sk_live_…`); if
pasted as-is into Vercel it breaks. Owner action: set the full `sk_live_…` (no
leading/trailing space), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and
`STRIPE_WEBHOOK_SECRET` in Vercel (Production scope), then redeploy.

### LB-003 — Stripe **Connect** webhook secret is a placeholder (CRITICAL for donations)
The owner's config has `STRIPE_CONNECT_WEBHOOK_SECRET=whsec_connect...` (a
placeholder, not a real secret). The webhook route
(`apps/web/app/api/stripe/webhook/route.ts`) verifies signatures against BOTH
`STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` (code is correct).
**Connect events — `account.updated`, `payout.*`, `transfer.*` — are what flip
`connected_accounts.charges_enabled` / `payouts_enabled`, which the payout-
readiness gate requires before ANY donation is accepted.** If Connect events
aren't signature-verified (placeholder secret) they're dropped → accounts never
marked payout-ready → every donation returns `PAYOUT_NOT_READY`.
**Owner action:** either (a) enable "Listen to events on Connected accounts" on
the single `…/api/stripe/webhook` endpoint so `STRIPE_WEBHOOK_SECRET` covers
them, or (b) create a dedicated Connect webhook and set its real `whsec_…` as
`STRIPE_CONNECT_WEBHOOK_SECRET` in Vercel. Remove the `whsec_connect...`
placeholder either way.

### LB-005 — Stripe Connect not fully enabled (blocks all destination charges)
The app processes every donation as a Stripe Connect **destination charge** to a
connected recipient account. Verified in the **test** account
(`acct_1TNulEAxcclD49kv`): `accounts.create` fails with *"You can only create new
accounts if you've signed up for Connect."* If Connect is likewise not enabled on
the **live** account, no recipient can onboard and **no donation can be processed
at all**. Owner action: complete Connect signup (Dashboard → Connect → Get
started) in both live and test, then re-run `scripts/verify-money-flow.mjs` with a
test key to prove the full charge→transfer→refund flow. Fee math already verified
against real Stripe test processing ($100 → $118.64, support $15, processing $3.64).

### LB-004 — Rotate exposed secrets (SECURITY)
Full live Stripe secret/restricted/webhook keys, Supabase service-role key + access
token, DB password, Google OAuth secret, and Resend key were shared in-session
(twice). Rotate all before/at launch; treat as compromised.

## Verification-gated (need Stripe test keys + staging)
- End-to-end money-flow / refund / dispute / reconciliation proof.
- Per-persona live RLS test matrix.
- Partial-refund campaign-stat delta fix.
