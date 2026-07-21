# CharitMe — Payment Readiness (owner hand-off)

> Executive summary of the payment audit-and-hardening pass. Engineering detail
> lives in `payment-audit.md`; launch blockers in `docs/LAUNCH_BLOCKERS.md`. This
> page is the decision-ready view: **what's fixed, what's verified, and the short
> list of things only you can do.**

## Bottom line

The payment **code** is now audited, repaired, and guarded. Eleven real defects
were fixed — several would have caused financial damage the moment donations went
live (double-counting every donation, double-paying every payout). The one thing
standing between you and live donations is **not code** — it's completing Stripe's
Connect account verification on your side.

## The ONE remaining launch blocker (owner action)

**Enable Stripe Connect on the live account `acct_1TNul7BrwQtGmNLk`.** Every
donation is a Stripe Connect destination charge; until Connect account creation is
enabled, every donation returns `PAYOUT_NOT_READY` by design (CharitMe never holds
funds). You had reached the final gate — the live platform-profile questionnaire +
Stripe's account verification at
`dashboard.stripe.com/connect/accounts/overview`. Complete that, then tell the team
and the money-flow can be proven end-to-end (`scripts/verify-money-flow.mjs` with a
test key — fee math already proven: $100 → $118.64).

Already done + verified on your side: **Vercel env** (`stripeKeyMode=live`, no
whitespace, real Connect webhook secret, `DEFAULT_DONOR_TIP_PERCENT=15`) and the
**database reconciliation** (31 → 132 tables, RLS on all).

## What was broken and fixed (11 defects)

| ID | Sev | What was wrong | Now |
|----|-----|----------------|-----|
| PAY-001 | 🔴 | A Stripe demo (`connect-sample`) shipped **unauthenticated** endpoints that created live Stripe accounts/checkouts | Removed entirely |
| PAY-004 | 🔴 | Every donation **double-counted** a campaign's raised total (trigger + manual increment) — proven live | Single count (trigger owns it) |
| PAY-006 | 🔴 | "Request Payout" **double-paid** recipients via a manual transfer (funds already delivered by the destination charge) | Routes to the Stripe dashboard; no manual transfer |
| PAY-002 | 🟠 | Refunds came out of the **platform** balance, not the charity's; stats reversed twice; partials mis-marked | Reverses the transfer + fee; single reversal |
| PAY-003 | 🟠 | Offline donations created a **duplicate** donation row | One row |
| PAY-009 | 🟠 | Tax receipts checked a nonexistent `profiles.is_admin` column → **denied every admin** | Uses the real role check |
| PAY-010 | 🟠 | Routes selected columns that don't exist → **exports, admin refunds, Impact, marketing sync all silently returned nothing** | Fixed; columns added where intended |
| PAY-011 | 🟡 | Writes to nonexistent columns → payout **audit trail lost**, reconciliation actions errored | Mapped to real columns |
| PAY-005 | 🟡 | Limited rewards could be **over-claimed** past their limit | Atomic guard |
| PAY-007 | 🟡 | Recurring donations were **invisible** in the admin Payments dashboard | Now recorded (initial charge) |
| PAY-008 | 🟢 | Payment detail rows could duplicate on re-record | Idempotent |

## What's now protected (regression guard)

A **schema-contract CI test** (`apps/web/__tests__/schema-contract.test.ts`) fails
the build if any code references a database column or RPC parameter that doesn't
exist — the class of bug behind PAY-009/010/011, which silently disabled **seven
user-facing features** and was invisible to the old test suite. It covers
`.select()`, `.insert/.update/.upsert()`, and `.rpc()`. Refresh after a migration
with `npm run schema:snapshot`.

## Verified sound (no change needed)

- **Architecture**: Stripe Connect destination charges → recipient gets the full
  donation → automatic Stripe payout. CharitMe never custodies funds; the
  payout-readiness gate blocks donations until the recipient is fully onboarded.
- **Fee math**: server-authoritative (no client trust); proven against real Stripe
  test processing.
- **Webhooks**: signature-verified + idempotent (event-log skip + advisory-lock RPC).
- **Recurring subscriptions**: full state machine + donor-only ownership, verified
  live.
- **Financial-table security**: 0 public read policies on any money table; 0 tables
  with RLS disabled DB-wide.

## Verification still gated on Connect (not faked)

Once Connect is live-enabled, these become runnable (they can't be executed now):
end-to-end charge→transfer→payout→refund proof; refund/dispute lifecycles via Stripe
test clocks; recurring-renewal observability + processor-fee enrichment; per-persona
live RLS matrix. Browser/mobile/accessibility/load tests need a harness this
environment doesn't have.

## Also for the owner (from LAUNCH_BLOCKERS)

- **Rotate secrets** (LB-004): live Stripe/Supabase/Resend keys were shared in
  chat during setup — treat as compromised and rotate before/at launch.
- **Confirm the Connect webhook** is subscribed to Connected-account events in the
  Stripe dashboard (secret presence ≠ subscription).
