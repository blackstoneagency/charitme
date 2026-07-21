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

---

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

## GATED (needs Stripe live verification or staging — NOT faked)

- End-to-end live charge→transfer→payout→reconcile proof (unblock: complete Stripe
  live platform-profile questionnaire + account verification, then run
  `scripts/verify-money-flow.mjs` with a test key — fee math already proven:
  $100 → $118.64).
- Refund/dispute financial-state lifecycle via Stripe test clocks.
- Browser / mobile / accessibility / load test execution.
