# CharitMe — Payment Workflow Audit & Hardening

> Living document. Honest scope: findings are recorded only when verified against
> real code / the live DB / real Stripe behavior. Nothing here is asserted from
> assumption. Items that require Stripe **live account verification** or a staging
> environment (not available in this session) are marked **GATED** rather than
> faked.

## Method & environment

- **Branch:** `master` (Vercel-deployed production branch). Synced to
  `origin/master` at audit start.
- **Baseline gates (measured):** `npm run typecheck` ✅ clean (after syncing deps
  to the locked `stripe@22.3.2`); `npm run test` ✅ **674 pass / 43 files**.
- **What CANNOT be executed here (documented, not faked):** live end-to-end
  charge→transfer→payout (Stripe Connect is not yet live-enabled on the production
  account `acct_1TNul7BrwQtGmNLk` — see LB-005); browser/mobile/accessibility/load
  test harnesses; PagerDuty. These are called out as GATED with the exact unblock.

## Payment architecture — verified

The production money path is **Stripe Connect destination charges** via Stripe
**Checkout** (hosted), which is production-appropriate for a fundraising
marketplace:

```
Donor → /campaigns/[slug] DonateButton → POST /api/donations
      → Stripe Checkout Session (mode:payment)
        · line items: donation + optional tip + optional processing
        · payment_intent_data.application_fee_amount = tip + processing
        · payment_intent_data.transfer_data.destination = recipient connected acct
      → charge captured → Stripe auto-transfers `amountCents` to the charity
      → application fee (tip + processing) retained by CharitMe
      → Stripe automatic payout → charity bank
```

**Recipient-first / no-custody guarantee is enforced in code:** `/api/donations`
and `/api/donations/recurring` both call `resolvePayoutDestination()` and return
`409 PAYOUT_NOT_READY` unless a fully-onboarded connected account exists
(`stripe_account_id` + `details_submitted` + `charges_enabled` + `payouts_enabled`,
`verification_status='verified'`). Beneficiary account is preferred over organizer.
On any Stripe destination/account/transfer error the routes **fail closed** (never
fall back to charging into the platform balance). ✅ Sound.

**Checkout vs Elements (architecture note):** the prompt prefers Elements/Embedded
over hosted Checkout. Hosted Checkout is a **deliberate, valid** choice here — it
minimizes PCI scope (SAQ A), natively supports Apple/Google Pay, Link, ACH, and
Cash App, and handles SCA/3DS. Migrating to Elements would *increase* PCI scope and
rebuild working flows for no functional gain. Kept as-is; documented as intentional.

---

## Findings

### PAY-001 — `connect-sample` demo island exposes UNAUTHENTICATED live-Stripe endpoints (CRITICAL — SECURITY) — ✅ FIXED
- **Area:** `apps/web/app/connect-sample/**`, `apps/web/app/api/connect-sample/**`,
  `apps/web/lib/connect-sample/**`, `apps/web/__tests__/connect-sample.test.ts`.
- **Root cause:** a self-contained Stripe Connect **V2** sample app (dashboard +
  fake storefront + success page + API) was merged into the repo. Its API routes
  have **no auth and no rate limiting** and use the shared **live** `STRIPE_SECRET_KEY`:
  - `POST /api/connect-sample/accounts` → creates live V2 connected accounts.
  - `POST /api/connect-sample/products` → creates live products/prices.
  - `POST /api/connect-sample/checkout` → creates live checkout sessions.
  - `POST /api/connect-sample/accounts/[id]/onboard` → live account links.
  - `POST /api/connect-sample/webhook` → a second, parallel webhook.
  It is not linked from any real UI (island reachable only by direct URL), and its
  own `client.ts` is labeled *"PLACEHOLDER — REQUIRED"*. It is both a fake-data path
  and a live-key abuse surface (arbitrary connected-account/product/checkout
  creation, resource exhaustion), and a conflicting second Connect implementation
  vs. the production V1 `connected_accounts` flow.
- **Security implications:** unauthenticated creation of live Stripe objects on the
  platform account; potential abuse / cost / laundering surface.
- **Resolution:** removed the entire island (pages + API + lib + its test). Nothing
  in the real product imports it, so the app stays deployable. Reference remains in
  git history if a V2 migration is ever desired.
- **Validation:** typecheck + full test suite re-run green after removal (see commit).

### PAY-002 — Admin refund route: platform ate destination-charge refunds + double-counted stat reversal + mis-marked partials (HIGH — FINANCIAL CORRECTNESS) — ✅ FIXED
- **Area:** `apps/web/app/api/admin/donations/[id]/refund/route.ts`.
- **Root causes (three real bugs):**
  1. **Platform ate the refund.** Donations are Connect **destination charges**
     (principal transferred to the charity; only the app fee stayed on the
     platform). The refund was created **without** `reverse_transfer` /
     `refund_application_fee`, so Stripe refunded the donor from the **platform**
     balance while the charity kept the transferred principal — the platform
     absorbed the full donation on every refund.
  2. **Double stat reversal.** The route called `decrement_campaign_stats(full
     amount)` directly, and the resulting `charge.refunded` webhook
     (`handleChargeRefunded`) **also** decremented — so campaign `raised_amount` /
     `backer_count` were reversed **twice** per refund.
  3. **Partial refunds mis-marked.** A partial refund set the whole donation
     `status='refunded'` and decremented the **full** donation amount (the webhook
     correctly keeps partials `completed` and skips the decrement).
- **Resolution:**
  - Refund now sets `reverse_transfer: true` + `refund_application_fee: true`
    (pulls the principal back from the charity, returns the proportional platform
    fee) — matching `scripts/verify-money-flow.mjs`. Falls back to a plain refund
    only when Stripe reports there is no transfer/fee to reverse (legacy
    non-destination charge); any other error is surfaced.
  - Removed the direct `decrement_campaign_stats` call — the idempotent
    `charge.refunded` webhook is now the single source of truth for stat reversal
    (event-level idempotency verified: `webhook_events.processed_at` skip).
  - Only a **full** refund flips the donation to `refunded`; a partial leaves it
    `completed` (the `status` enum has no `partially_refunded`) and is tracked in
    the `refunds` table + reconciliation ledger.
- **Files modified:** the one route above (+ `import type Stripe`).
- **Validation:** typecheck clean; lint 0 errors; 662 tests pass. Live
  charge→refund→transfer-reversal proof is **GATED** on Stripe test clocks /
  Connect live-enablement (documented, not faked); the fix mirrors the pattern the
  money-flow script already proves.

### PAY-004 — `record_donation` DOUBLE-COUNTED every donation's campaign totals (CRITICAL — FINANCIAL ACCURACY, live-proven) — ✅ FIXED
- **Area:** `record_donation` RPC (live DB + `supabase/migrations`, `schema.sql`,
  `catch_up.sql`, `apps/web/app/api/admin/apply-schema/route.ts`).
- **Root cause:** the original schema (`20260525000000_initial_schema`) defines an
  `AFTER INSERT` trigger `donations_increment_campaign_stats` that already
  increments `campaigns.raised_amount` (+amount) and `backer_count` (+1) for every
  `status='completed'` donation row. A later change
  (`20260719120000_record_donation_idempotency_lock`) **added a manual
  `update campaigns set raised_amount = raised_amount + amount, backer_count += 1`**
  inside `record_donation` — unaware the trigger already did it. Both fire.
- **Proven LIVE (controlled, fully reverted test):** one `record_donation(12345)`
  call created **1** donation row but moved a campaign from
  `raised_amount 4500 → 29190` (**+24690 = 2×**) and `backer_count 1 → 3` (**+2**).
  Every webhook donation (one-time + recurring first payment + renewals) inflated
  campaign totals **2×**. (Seeded rows were bulk-inserted and only ever hit the
  trigger once, so historical seed totals are single-counted — the bug bites every
  *new* real donation, i.e. the moment donations go live.)
- **Resolution:** migration `20260721000000_fix_record_donation_double_count.sql`
  recreates `record_donation` **without** the manual `update campaigns` (the
  trigger is the single source of truth). Non-destructive `CREATE OR REPLACE`
  (no data touched). Mirrored the removal into `schema.sql`, `catch_up.sql`, and
  the inline `apply-schema` bootstrap so the bug can't be reintroduced.
- **Applied to the live DB** (Management API) and **re-verified LIVE:** the same
  call now moves `4500 → 16845` (**+12345 = 1×**) and `backer_count 1 → 2` (**+1**).
  Test data deleted, campaign restored to its exact baseline (4500/1), zero residue.
- **Validation:** typecheck clean; 662 tests pass.

### PAY-003 — Offline donations created a DUPLICATE row + extra stat count (HIGH — DATA INTEGRITY) — ✅ FIXED
- **Area:** `apps/web/app/api/offline-donations/route.ts`.
- **Root cause:** the route inserted the offline `donations` row directly (with
  offline metadata) — which already fires the increment trigger — **and then also
  called `record_donation`**, which inserts a SECOND donation row (without the
  offline fields) and (pre-PAY-004) incremented again. Net before fix: **2 donation
  rows** per offline donation (donor wall / exports showed it twice) and, combined
  with PAY-004, a ~3× stat inflation.
- **Resolution:** removed the `record_donation` call; the direct insert alone fires
  the trigger to increment stats exactly once.
- **Verified LIVE (reverted):** an offline insert done exactly as the fixed route
  now yields **+amount once, +1 backer, exactly 1 row** (was 2 rows). Baseline
  restored, zero residue.
- **Validation:** typecheck clean; 662 tests pass.
- **Live data cleanup — investigated, NONE needed (owner-authorized check, 2026-07-21):**
  the 25 `offline=true` rows in the live DB are all **seed data** (100% carry the
  procedural seed timestamp `.126906`; `offline_method` is NULL, which the route
  always sets), so they never ran through the buggy route. A join test for the
  bug's signature — an `offline=true` row A with a matching `record_donation` row B
  (same `campaign_id` + `amount_cents`, both stripe ids null, donor_id null, within
  5s) — returned **0 pairs**. The 24 rows that superficially matched the row-B
  shape are legitimate **seeded anonymous donations** (all `anonymous=true`, 24
  distinct campaigns, no internal duplicates). Conclusion: the PAY-003 bug never
  executed against real production data (donations are not live yet), so **nothing
  was deleted** — removing those rows would have corrupted legitimate seed data.
  All checks were read-only.

### PAY-005 — Limited rewards could be over-claimed past `item_limit` (LOW-MED — DATA INTEGRITY) — ✅ FIXED
- **Area:** `claim_campaign_reward` RPC (called from the checkout webhook).
- **Root cause:** the donations route pre-checks `claimed_count < item_limit`
  before creating the Checkout Session, but the webhook then ran an
  **unconditional** `claimed_count = claimed_count + 1`. Two donors who both pass
  the pre-check and pay can push `claimed_count` past `item_limit` (check-then-act
  race) — over-selling a limited perk.
- **Resolution:** migration `20260721010000_claim_reward_limit_guard.sql` adds the
  atomic guard `... where id = p_reward_id and (item_limit is null or
  claimed_count < item_limit)`; a claim after exhaustion matches 0 rows (the
  donation still stands, the perk is simply unavailable). Mirrored into
  `schema.sql`, `catch_up.sql`, the `20260610000000` reward-tiers migration, and
  the `apply-schema` bootstrap. Applied to the live DB.
- **Verified LIVE (reverted):** with `item_limit=1`, claim #1 → `claimed_count=1`,
  claim #2 → stays `1` (no over-claim). Test reward deleted, zero residue.
- **Validation:** typecheck clean; 662 tests pass.

### PAY-006 — Self-service payout route DOUBLE-PAID recipients via a manual transfer (CRITICAL — FINANCIAL) — ✅ FIXED
- **Area:** `apps/web/app/api/payouts/route.ts` (+ `dashboard/payouts/RequestPayoutButton.tsx`).
- **Root cause:** the "Request Payout" button (live on `/dashboard/payouts`) called
  `/api/payouts`, which ran `stripe.transfers.create({ amount: raised_amount −
  alreadyPaidOut, destination: <organizer connected account> })`. But CharitMe uses
  **destination charges** — every donation already transferred its principal to that
  same connected account at charge time, and Stripe auto-pays it out. A second,
  platform-initiated transfer of the whole `raised_amount` therefore **double-pays
  the recipient** out of the platform balance (which only holds application fees),
  overdrawing the platform. The route also computed "available balance" from
  `campaigns.raised_amount`, a denormalized figure — not the real Stripe balance.
  This contradicts the intended architecture (destination charge → **automatic**
  Stripe payout → bank).
- **Resolution:** removed the manual transfer entirely. `/api/payouts` now returns a
  single-use **Stripe Express dashboard login link**
  (`stripe.accounts.createLoginLink`) so the organizer views their real balance,
  payout schedule, and history and can start an instant payout in Stripe. The
  dashboard button was reworked to "Manage Payouts" — it explains payouts are
  automatic and opens the Stripe dashboard, instead of a money-request modal with
  (now-meaningless) speed-fee options. Auth + connected-account-ready checks kept.
  The admin payout route (`/api/admin/payouts`) was audited and is safe — it only
  writes a `payouts` bookkeeping row, no Stripe transfer.
- **Validation:** typecheck clean; lint 0 errors; 712 tests pass. (Live login-link
  generation is exercised once Connect is live-enabled — GATED on LB-005.)

### PAY-007 — Recurring donations were absent from the payment-observability layer (MEDIUM — TRACEABILITY) — ✅ FIXED (initial charge; renewals documented)
- **Area:** `apps/web/app/api/stripe/webhook/route.ts` (`handleCheckoutComplete`).
- **Root cause:** `recordCampaignPayment` was called only in the **one-time** donation
  branch. Recurring donations created `donations` + `recurring_donations` rows but
  **no `campaign_payments` row**, so the admin Payments dashboard
  (`getPaymentAdminData`) — the "every payment is traceable" surface — never showed
  recurring payments at all.
- **Resolution:** the recurring branch now records a `campaign_payments` row (parity
  with one-time: `gross=amount`, `tip`, `platform_fee=tip`, `owner_net=amount`,
  processor fee 0 pending), so recurring **initial** payments are now traceable in
  the dashboard. `recordCampaignPayment` was made idempotent first (see PAY-008), so
  webhook retries don't duplicate.
- **Documented remaining (honest, not silently skipped):** (a) subscription
  **renewals** (`invoice.payment_succeeded`) still don't create a `campaign_payments`
  row — there's no checkout session to key on, so it needs invoice→payment plumbing;
  (b) for recurring, the processor fee isn't auto-enriched because the row is keyed
  by checkout session (no top-level `payment_intent` on a subscription session), so
  `handleChargeObserved` can't match it — the row stays `pending_data` on the fee.
  Both are refinements best built + verified against **live** recurring Stripe flows
  (GATED on Connect enablement), not guessed at here.
- **Validation:** typecheck clean; 712 tests pass.

### PAY-008 — `recordCampaignPayment` child-detail rows were not idempotent (LOW — latent) — ✅ FIXED
- **Area:** `apps/web/lib/payment-flow.ts`.
- **Root cause:** the parent `campaign_payments` row and the reconciliation row were
  upserted, but the `campaign_payment_breakdowns` / `campaign_platform_fees` /
  `campaign_processor_fees` detail rows were unconditional `.insert()`s. A second
  call for the same payment (a future caller, a re-record) would duplicate them.
  Not currently triggered (called once per idempotent `checkout.session.completed`)
  and it only affects the per-transaction detail list (no summed metric reads these),
  hence LOW — but it made the recorder unsafe to reuse (e.g. for PAY-007).
- **Resolution:** the three detail inserts now run **only when the parent payment is
  newly created**; the reconciliation upsert still always refreshes, and post-hoc fee
  corrections continue to flow through the idempotent upserts in
  `handleChargeObserved`. `recordCampaignPayment` is now safely idempotent.
- **Validation:** typecheck clean; 712 tests pass.

### PAY-009 — Tax-receipt route checked a nonexistent `profiles.is_admin` column → denied ALL admins (HIGH — BROKEN FEATURE) — ✅ FIXED
- **Area:** `apps/web/app/api/admin/donations/tax-receipt/route.ts`.
- **Root cause:** the route's local `isAdmin` ran
  `profiles.select('is_admin').eq('id', userId)`, but there is **no `is_admin`
  column** on `profiles` (verified live) — admin status lives in the `roles` jsonb
  (`roles ? 'admin'`; 5 such admins live). The select errors on the missing column
  → `data` is null → `isAdmin` returns false for **everyone**, so every legitimate
  admin got `403 Forbidden` and the tax-receipt feature was entirely non-functional.
- **Resolution:** replaced the broken local check with the shared
  `isAdmin(user.id, user.email)` from `lib/roles` (roles + owner emails +
  `ADMIN_EMAILS`), matching every other admin route. Scanned the codebase —
  this `profiles.is_admin` misuse was isolated to this one route; the sibling
  `admin/donations/[id]/receipt` correctly uses `verifyAdmin`.
- **Validation:** typecheck clean; 729 tests pass.

### PAY-010 — Codebase-wide sweep: routes selecting NONEXISTENT columns (silently broke features) — ✅ FIXED
Prompted by PAY-009, I checked every `.from(table).select(...)` in `apps/web`
against the live column inventory (143 tables). PostgREST errors the whole query on
an unknown column, and these call sites ignored the error → the feature silently
returned nothing. Four real breakages (beyond the false-positive embedded joins like
`profiles!donor_id(...)`):

- **`donations.donor_name` / `donations.donor_email` don't exist** (only
  `offline_donor_name`/`offline_donor_email`) → **all three exports broke**:
  `/api/exports/donations` (CSV always empty), `/api/exports/donors`,
  `/api/exports/full`. Fixed: resolve donor name from `donor_id`→`profiles.full_name`
  / `offline_donor_name` / anonymous; drop `donor_email`.
- **`refunds.reviewed_by` / `refunds.updated_at` don't exist** → `GET/PATCH
  /api/admin/refunds` (the refund-request review console) errored on every list and
  status update. The workflow clearly intends them (status enum has
  `under_review/approved/declined`), so added them via migration
  `20260721020000_refunds_review_columns.sql` (additive; applied live).
- **`campaigns.currency` doesn't exist** (currency is in
  `campaign_launch_settings`) → `lib/impact.ts#resolveCampaign` returned null for
  **every** campaign, so the entire Impact feature returned nothing. Fixed: select
  real columns + look currency up from `campaign_launch_settings` (default `usd`).
- **`profiles.country` doesn't exist** → `POST /api/admin/marketing/contacts` bulk
  sync errored and imported **0** contacts. Fixed: dropped the column from the
  select.

**Verified live:** all four previously-erroring queries now return rows against the
production DB. Re-ran the sweep — only valid embedded-relation joins remain (no real
mismatches). Typecheck clean; 729 tests pass. (Note: this class is invisible to the
test suite because no test drives these authed/admin routes against the real schema —
worth a schema-contract test in CI.)

---

### PAY-011 — Write side of the nonexistent-column class: broken INSERT/UPDATE columns (MED — SILENT WRITE FAILURES) — ✅ FIXED
Extending the sweep to `.insert/.update/.upsert` object keys (write side) found more
real breakages — a bad write column makes the whole statement error; several were in
try/catch so the feature "worked" but the write was silently lost:
- **`audit_logs.resource_type`/`resource_id` don't exist** (the table uses
  `target_type`/`target_id`) → payout audit-log inserts in `/api/admin/payouts` and
  `/api/admin/payouts/[id]` silently failed, so payout actions left **no audit
  trail**. Fixed to `target_type`/`target_id`.
- **`campaign_payment_reconciliation.reason`/`reviewed_by`/`reviewed_at` don't
  exist** → the admin "mark reviewed" and "retry reconciliation" actions
  (`/api/admin/payments/[transactionId]/actions`) errored on write. Mapped to the
  real columns (`updated_by`/`updated_at`; the human-readable reason is already
  stored on `campaign_payments.reconciliation_reason` + the `issues` array).
- **`campaign_payment_disputes.closed_at` doesn't exist** → the `charge.dispute.closed`
  webhook write errored. Dropped it (`updated_at` records the close time).
- **Filter side (`.eq/.in/.order`) intentionally NOT added to CI**: the only 3
  candidates were false positives — filters applied to a query builder stored in a
  variable (`const base = from('marketing_contacts')…; base.eq('client_type',…)`)
  can't be attributed to a table statically. Left out to keep CI false-positive-free.
- **Validation:** typecheck clean; 730 tests pass; every fixed write uses only
  columns confirmed present in the live schema.

### Durable prevention — schema-contract CI test — ✅ SHIPPED
The PAY-009/010 class (querying columns that don't exist → fail closed → silently
broken feature) is invisible to normal tests. Added a **schema-contract test** so it
becomes a build failure instead:
- `apps/web/__tests__/schema-contract.test.ts` parses every
  `.from(table).select(...)` in `apps/web/{app,lib}` and asserts each selected
  column exists in a committed snapshot, correctly skipping PostgREST embedded
  relations / aliases / casts / json ops / dynamic selects. Failure prints the exact
  `file:line table.column`.
- `apps/web/__tests__/fixtures/schema-columns.json` — the committed 143-table
  column snapshot (path-anchored via `import.meta.url`, so an empty scan can't pass
  trivially).
- `scripts/schema-snapshot.mjs` + `npm run schema:snapshot` — regenerates the
  snapshot from the live DB after a migration.
- Already runs in CI via the existing `npm test --workspace=apps/web` step.
- **Now also checks writes:** `.insert/.update/.upsert({...})` object keys when
  DIRECTLY chained to `.from(table)` (a robust brace/string/comment-aware key
  parser). Directly-chained only, so query-builders stored in variables (the filter
  false-positive class) are safely skipped.
- **And RPC parameters:** `.rpc('fn', {...})` keys are validated against the
  function's named parameters (from `fixtures/schema-functions.json`, 47 functions).
  Only functions with named params are checked, so Postgres built-ins (`pg_notify`)
  and no-arg functions are skipped — false-positive-free. An RPC sweep found **0
  current violations** (`record_donation`, `claim_campaign_reward`,
  `increment/decrement_campaign_stats` all correct); this guards the core money
  functions against future parameter drift.
- **Proven to catch the bug:** injecting a bad `.select()` column, a bad `.insert()`
  key, and a bad `.update()` key each fail the test with the exact
  `file:line table.column`; all pass again on removal. Green on the current codebase
  (730 tests total).

## RLS-contract CI guard — ✅ SHIPPED

The financial-RLS audit below is now a **build-time invariant**, not a one-off check.
`apps/web/__tests__/schema-rls.test.ts` pins the live RLS posture
(`fixtures/schema-rls.json`, refreshed by `npm run schema:snapshot`) and fails CI if:
1. **any** public table has RLS disabled (raw anon leak), or
2. any **sensitive** table (profiles, donations, connected_accounts, payouts,
   refunds, ledger_entries, all `campaign_payment_*` / fees, recurring_donations,
   donor_crm_contacts, privacy_requests, audit_logs, webhook_events, matching_claims)
   has a public `USING(true)` read policy (the LB-006 leak class).
Proven to catch both an injected RLS-disabled table and an injected public-read on
`profiles`; green on the current DB.

## Financial-table RLS posture — audited live, VERIFIED SOUND

Checked the row-level-security posture of every payment/financial table against the
live DB (the defense against direct anon/authenticated-key reads — the app itself
uses the service-role client which bypasses RLS):

- **0 public (`USING true`) read policies** on any of the 23 financial-table
  read/all policies — no repeat of the LB-006 profiles leak in the money domain.
- **`campaign_payment_*` internals** (payments, breakdowns, platform/processor fees,
  reconciliation, disputes, events, exports, settings, webhook events, audit notes,
  ledger_entries): `is_admin()`-only for writes/all, plus an owner-scoped read on
  `campaign_payments`/`campaign_payment_breakdowns` via
  `campaign_payment_owner_can_read(campaign_id, campaign_owner_id)` so an organizer
  sees only their own payment rows.
- **`connected_accounts` / `payouts` / `refunds`**: read = own
  (`auth.uid() = user_id` / `= requested_by`) OR admin. No cross-tenant financial
  read; `stripe_account_id` not exposed to other users.
- **`payment_processors`**: readable by any authenticated user
  (`auth.uid() IS NOT NULL`), but it holds only non-sensitive processor config
  (`display_name`, `status`, `dashboard_url`, and metadata keys
  `campaign_donations`/`setup_required`) — no secrets. Acceptable.
- **DB-wide:** **0 public base tables have RLS disabled** (no raw anon-leak
  anywhere); 19 tables are RLS-enabled deny-all (service-role-only — the intended
  pattern for internal/admin tables). No change required.

## CSV export & receipt routes — audited, all sound

- **CSV formula-injection helper** (`lib/csv.ts`, CHAR-F010): neutralizes leading
  `= + - @ \t \r` on non-numeric cells + structural quoting. Solid.
- **Every export uses it (or JSON):** `exports/donations`, `exports/donors`,
  `admin/payments/export`, `admin/reports/export`, `analytics/export` all route
  user-controlled values through the helper; `exports/full` emits JSON (no formula
  risk).
- **Auth + scoping correct:** user exports are auth-gated and scoped by
  `user_id`/`owner_id` (own campaigns/donors only); admin exports are gated by
  `requireAdmin` / shared `isAdmin`. Receipt routes: donor receipt is
  owner-or-admin scoped; admin receipt uses `verifyAdmin`.

## Verified sound (no change required)

- **Fee math (displayed == charged):** client and server both compute
  `donorTip` + `methodProcessingFee` from `@shared/fees`; `application_fee_amount`
  is server-authoritative (no client fee trust). Unit-tested.
- **Webhook idempotency:** `record_donation` RPC + event-log skip; recurring upsert
  keyed on the `recurring_donations_stripe_subscription_id_key` UNIQUE index
  (verified live — webhook retry returns same row, no duplicate).
- **Recurring subscription state machine:** `active→paused→active→past_due→cancelled`
  with per-transition guards; donor-scoped ownership (organizer cannot cancel a
  donor's gift). Verified live against the reconciled DB.
- **Platform plan checkout** (`/api/stripe/checkout`): auth-gated subscription-mode
  Checkout with env price IDs; metadata (`userId/plan/billing`) matches the webhook's
  SaaS-subscription branch and `customer.subscription.updated/deleted`. Correctly no
  destination charge (platform's own revenue).
- **Admin payout route** (`/api/admin/payouts`): admin-gated; writes a `payouts`
  bookkeeping row only — **no** Stripe transfer (safe, unlike the old self-service
  route fixed in PAY-006).
- **Admin payment actions** (`/api/admin/payments/[transactionId]/actions`):
  admin-gated; only notes / mark-reviewed / retry-reconciliation (pure
  `reconcileMoneyFlow` calc) — no money movement.
- **Donor receipt** (`/api/donations/receipt`): auth + owner-or-admin scoped;
  emails the authenticated user only.
- **Dispute handling** (`charge.dispute.created/closed`): sets `status='disputed'`,
  records the chargeback in `refunds`, flags reconciliation for finance review, and
  audit-logs. Deliberately does not auto-adjust campaign stats until a dispute is
  resolved (reconciliation-aware design) — noted, not a defect.
- **Connect onboarding** (`/api/stripe/connect`): express account + `transfers`
  capability (correct for destination charges); the payout-readiness gate
  independently requires `charges_enabled`+`payouts_enabled`, so the immediate
  `verification_status='verified'` label can't open the gate prematurely.
- **`lib/stripe.ts`**: key trimming; missing-key proxy; comprehensive payment
  methods (card→Apple/Google Pay, Link, Cash App, ACH, PayPal, BNPL); progressive
  method-stripping with per-retry idempotency keys.

## GATED (needs Stripe live verification or staging — NOT faked)

- End-to-end live charge→transfer→payout→reconcile proof (unblock: complete Stripe
  live platform-profile questionnaire + account verification, then run
  `scripts/verify-money-flow.mjs` with a test key — fee math already proven:
  $100 → $118.64).
- Refund/dispute financial-state lifecycle via Stripe test clocks.
- Browser / mobile / accessibility / load test execution.
