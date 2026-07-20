# CharitMe — Launch Blockers

## OPEN — found 2026-07-20 (anon-persona live RLS certification)

### LB-006 — profiles table leaks PII/billing IDs to anonymous callers (HIGH — SECURITY)
`profiles` RLS is enabled but the SELECT policy was `profiles_read USING (true)`,
so **any unauthenticated caller** using the public anon key (which ships in the
client bundle) can dump **every** profile row. Proven live:
`GET https://yanexccimwooursawynm.supabase.co/rest/v1/profiles?select=email,full_name`
returns **502 rows** including `email`, `stripe_customer_id`,
`stripe_subscription_id`, `roles`, `plan`, and notification prefs. The table has a
`show_public_profile` flag the policy ignores entirely.
- **Blast radius:** unauthenticated harvest of all users' email addresses + Stripe
  customer/subscription identifiers. GDPR/CCPA-relevant personal-data exposure.
- **Why the app still works after a fix:** every public profile surface
  (`/donors/[id]`, `/profile`, campaign organizer display) reads via the
  service-role client (`supabaseAdmin`), which bypasses RLS. Restricting the base
  policy to own-or-admin does not change rendered output; it only closes the
  anon dump. (If a per-column public surface is ever needed, add a view exposing
  only safe columns gated on `show_public_profile`.)
- **Fix prepared (not yet applied):**
  `supabase/migrations/20260720120000_fix_profiles_pii_leak_and_campaigns_rls_recursion.sql`
  sets `profiles_read USING (auth.uid() = id or is_admin())`.
- **Owner action:** authorize applying the migration to the live DB (no staging
  exists). Treat as urgent — the leak is live now.

### LB-007 — campaigns RLS has infinite recursion (MED — broken policy / 500 landmine)
`campaigns_public_read` does `EXISTS(... team_members ...)` while
`team_members.team_campaign_read` does `EXISTS(... campaigns ...)` → mutual
recursion → **`42P17` "infinite recursion detected in policy for relation
campaigns"** on ANY RLS-enforced SELECT of `campaigns` (anon or logged-in user).
Proven live: `GET /rest/v1/campaigns?select=id&limit=3` → HTTP 500. The subquery
also had a bug (`tm.campaign_id = tm.id`, should correlate to `campaigns.id`).
- **Not a current outage:** the public campaign pages (`/campaigns`,
  `/campaigns/[slug]`) and home feed read via `supabaseAdmin` (RLS bypassed), so
  browsing works. But campaigns RLS is **effectively non-functional** and any
  future anon/user-key read of campaigns will 500.
- **Fix prepared (not yet applied):** same migration adds a SECURITY DEFINER
  helper `is_campaign_team_member()` (owner-privileged, does not re-enter RLS —
  mirrors `is_admin()`) and rewrites the policy to use it with the corrected join.
- **Owner action:** authorize applying the migration to the live DB.

---

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

### LB-002 — Stripe env (`STRIPE_SECRET_KEY`) in Vercel — ✅ RESOLVED (2026-07-20)
Payout onboarding errored in prod ("STRIPE_SECRET_KEY … in Vercel"). Code
hardened to trim + surface the real reason (`f8989eb`); root cause was a **leading
space** on the Vercel value. **Verified fixed** via the non-secret `/api/health`
config readout after redeploy: `stripeKeyMode=live`, `stripeKeyHasWhitespace=false`,
`publishableKey=set`, `stripeWebhookSecret=set`. Env is correct in Production.

### LB-003 — Stripe **Connect** webhook secret is a placeholder — ✅ RESOLVED (2026-07-20)
The config had `STRIPE_CONNECT_WEBHOOK_SECRET=whsec_connect...` (a placeholder).
The webhook route verifies signatures against BOTH `STRIPE_WEBHOOK_SECRET` and
`STRIPE_CONNECT_WEBHOOK_SECRET`; Connect events (`account.updated`, `payout.*`,
`transfer.*`) flip `connected_accounts.charges_enabled` / `payouts_enabled`, which
the payout-readiness gate requires. **Verified fixed** via `/api/health`:
`stripeConnectWebhookSecret=set` (the readout explicitly flags the `whsec_connect...`
stub as `PLACEHOLDER`; it now reports `set`, i.e. a real secret). NOTE: still
confirm the Connect endpoint is actually subscribed to Connected-account events in
the Stripe dashboard so those events are delivered (secret presence ≠ subscription).

### LB-005 — Stripe Connect: signed up, live account creation still gated (blocks all destination charges)
The app processes every donation as a Stripe Connect **destination charge** to a
connected recipient account, so live donations cannot process until
`accounts.create` succeeds on the **production** account
(`acct_1TNul7BrwQtGmNLk` — the account the deployed `sk_live_…` key belongs to;
confirmed via `GET /v1/account`: charges/payouts/details all enabled).

**Progress (2026-07-20, via live create-then-delete probes — nothing persisted):**
the `accounts.create` error advanced through three states as onboarding
progressed, so this is being actively worked, not stuck:
1. *"You can only create new accounts if you've signed up for Connect"* → Connect
   not signed up.
2. *"Please review the responsibilities of managing losses for connected
   accounts"* → Connect signed up; platform-profile loss/refund/chargeback
   acknowledgements pending. **Now completed** (platform profile shows *Refunds
   and chargebacks liability = Stripe*, both acknowledgements *Completed
   2026-07-20*, funds flow = buyers purchase from platform, sellers paid out
   individually, Express dashboard).
3. **Current:** *"You must complete your platform profile to use Connect and
   create **live** connected accounts. …answer the questionnaire"* → the full
   **live** platform-profile questionnaire + **Stripe account verification** are
   the remaining gate. This is Stripe's own review ("verify your account"); no
   code change bypasses it.

**Owner action (final step):** complete the live platform-profile questionnaire at
`dashboard.stripe.com/connect/accounts/overview` and clear Stripe's account
verification. Live connected-account creation unlocks when Stripe finishes that
review.

**Test-mode verification available without live verification:** test-mode Connect
does **not** require Stripe's live account verification. To prove the full
charge→transfer→refund path now, either (a) provide this account's **test** key
(`sk_test_51TNul7BrwQtGmNLk…`), or (b) enable Connect on a sandbox and use its
test key — then `scripts/verify-money-flow.mjs` runs the destination-charge flow
end-to-end. Fee math already verified against real Stripe test processing
($100 → $118.64, support $15, processing $3.64).

### LB-004 — Rotate exposed secrets (SECURITY)
Full live Stripe secret/restricted/webhook keys, Supabase service-role key + access
token, DB password, Google OAuth secret, and Resend key were shared in-session
(twice). Rotate all before/at launch; treat as compromised.

## Verification-gated (need Stripe test keys + staging)
- End-to-end money-flow / refund / dispute / reconciliation proof.
- Per-persona live RLS test matrix.
- Partial-refund campaign-stat delta fix.
