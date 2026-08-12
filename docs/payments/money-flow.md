# CharitMe — Donation Money Flow

> Status: documents the **currently implemented** flow (audited from code, not
> aspirational). Financial/legal claims below are engineering descriptions, not
> legal advice. Merchant-of-record status, charitable-solicitation obligations,
> money-transmitter exposure, escrow/custody implications, and tax treatment
> **must be validated by qualified payments, legal, tax, and compliance counsel
> before production launch.**

## Core guarantee: CharitMe never holds recipient funds

Every donation is created as a **Stripe Connect destination charge** whose
`transfer_data.destination` is the **recipient's own verified connected
account**. Stripe moves the net donation to the recipient at charge time; it is
never routed into CharitMe's platform balance and never sits there awaiting
payout setup.

CharitMe's revenue is limited to the disclosed **application fee**
(`application_fee_amount`), which today equals the optional donor **tip** plus
any donor-elected **processing-fee coverage** — never the donation principal.

Source of truth: `apps/web/app/api/donations/route.ts`,
`apps/web/lib/payout-destination.ts`, `apps/web/lib/stripe.ts`, and the webhook
`apps/web/app/api/stripe/webhook/route.ts`.

## No donation before payout readiness (enforced)

`POST /api/donations` calls `resolvePayoutDestination(campaign)` **before**
creating any Stripe session. A destination is returned only when a connected
account passes `accountIsPayoutReady(...)`, which requires **all** of:

- `verification_status = 'verified'` (filtered in the query),
- `details_submitted` — Stripe onboarding completed,
- `charges_enabled` — the account can take a (destination) charge,
- `payouts_enabled` — the recipient can actually be paid out,
- a non-empty `stripe_account_id`.

If no ready account exists, the endpoint returns **HTTP 409 `PAYOUT_NOT_READY`**
and **no charge is created**. Resolution order is **beneficiary first, then
organizer** — a campaign run on someone's behalf routes funds directly to that
person; the organizer never touches the money.

Covered by tests: `apps/web/__tests__/payout-destination.test.ts` (money-flow
test #1). Even if a stale account slipped through, the endpoint's catch block
maps Stripe destination/account/transfer errors to `PAYOUT_NOT_READY` rather
than ever falling back to a platform charge.

## Fee model (server-authoritative)

| Component | Who receives it | Notes |
|-----------|-----------------|-------|
| Donation principal (`amountCents`) | Recipient connected account | via `transfer_data.destination` |
| Optional donor tip (`tipCents`) | CharitMe (application fee) | percentage clamped 0–100 **server-side** |
| Optional processing-fee coverage | Offsets Stripe's deduction | only when donor opts in |

Amounts are computed on the server (`@shared/fees`: `donorTip`,
`methodProcessingFee`, `methodProcessorCost`); the client cannot alter the fee.
Processing coverage is solved against the final donor charge in integer cents,
so the campaign receives the promised principal and CharitMe nets the disclosed
tip. If the donor declines processing coverage, Stripe's cost is deducted from
campaign proceeds instead. Tips are opt-in and must never use dark patterns.

## Idempotency

- Checkout creation uses a per-request Stripe `idempotencyKey`
  (`donation_<campaign>_<amount>_<user>_<requestKey>`) so a double-submit does
  not create duplicate charges.
- Webhook processing is idempotent: `record_donation` takes a transaction-level
  advisory lock keyed on the payment intent / checkout session id, so duplicate
  or concurrent `checkout.session.completed` deliveries cannot double-count a
  donation or inflate campaign totals (migration `20260719120000`).

## Decision: destination charges (not direct charges) — REVIEW REQUIRED

The master prompt **prefers direct charges** on the connected account and allows
destination charges only with documentation. CharitMe currently uses
**destination charges**.

- **Why (today):** destination charges keep a single Checkout integration,
  centralized `application_fee_amount` handling, and one webhook surface while
  still transferring net proceeds to the recipient at charge time. The platform
  does not retain donation principal.
- **Trade-off vs. direct charges:** with destination charges the **platform is
  the merchant of record** and can bear more responsibility for refunds,
  disputes, chargebacks, and negative-balance recovery than with direct charges
  (where the connected account is the merchant of record). This has real
  regulatory, tax, and liability implications.
- **Required before launch:** confirm merchant-of-record posture, money-
  transmitter / charitable-solicitation exposure, and dispute/negative-balance
  liability with qualified counsel; if direct charges are required, feature-flag
  the charge model **by country and recipient type** and prove via reconciliation
  that no recipient funds become available for CharitMe operating use. Record the
  final decision (and approvals) in `decisions.md` as an ADR.

## Reconciliation, refunds, disputes, and payouts

Authoritative Stripe events reconcile Charge, Balance Transaction, Application
Fee, Transfer, connected account, and Payout IDs against immutable Supabase
ledger entries. Missing transfers, wrong destinations, amount/fee differences,
failed transfers, and payout allocation differences open reconciliation
exceptions. Refunds preserve donor gross and campaign principal separately;
lost disputes reverse the proven destination transfer before the event is
acknowledged.

See `docs/payments/stripe-connect-audit.md` and the generated sandbox evidence
in `docs/payments/stripe-test-evidence.latest.json`.

## Remaining policy decision

The direct-charge feature-flag path by country and recipient type remains a
future architecture option. It is not silently mixed into the current flow.
Qualified payments and legal counsel must approve the destination-charge
merchant-of-record, dispute, and negative-balance posture before general
availability.
