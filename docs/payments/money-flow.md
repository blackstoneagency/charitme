# CharitMe — Money Flow (as-built audit)

> Audited against the live code paths (`app/api/donations/route.ts`,
> `lib/payout-destination.ts`, `app/api/stripe/webhook/route.ts`,
> `app/api/stripe/connect/route.ts`). This documents what the code **actually does
> today**, not an aspiration. Any change to the charge model requires the sign-off
> in `decisions.md` ADR-P1 before implementation.
>
> ⚠️ Not legal, tax, or payments-compliance advice. Merchant-of-record status,
> charitable-solicitation registration, money-transmitter exposure, and tax
> treatment must be validated by qualified professionals before launch.

## Core guarantee (verified in code) ✅

**CharitMe never holds donor funds beyond its disclosed fee, and never accepts a
donation before the recipient is payout-ready.**

- `POST /api/donations` calls `resolvePayoutDestination(campaign)` **before** creating
  any charge. If it returns `null`, the endpoint returns **`409 PAYOUT_NOT_READY`** and
  no charge is created.
- `resolvePayoutDestination` → `verifiedAccount(userId)` requires ALL of:
  `verification_status = 'verified'`, `details_submitted`, `payouts_enabled`,
  `charges_enabled`, and a non-null `stripe_account_id`. A half-onboarded account does
  not qualify.
- Recipient resolution order: **beneficiary's** verified account first, else the
  **organizer's** verified account. When a beneficiary is set, the organizer never
  touches the money.
- On any Stripe destination/account error the handler **blocks** with
  `PAYOUT_NOT_READY` — it explicitly does **not** fall back to charging the platform
  balance.

## The charge (as-built): Stripe Connect **destination charge**

Per donation the server builds a Checkout Session (`mode: 'payment'`) with:

```
payment_intent_data: {
  application_fee_amount: tipCents + processingFeeCents,   // CharitMe revenue + fee offset
  transfer_data: { destination: <recipient connected acct> } // net donation → recipient
}
```

- **Gross the donor pays** = `amountCents` (donation) + `tipCents` (optional platform tip)
  + `processingFeeCents` (only if the donor opts to cover it), as separate line items.
- **Recipient receives** `amountCents` (the donation), transferred to their connected
  account by Stripe when the charge is captured.
- **CharitMe receives** only the `application_fee_amount` (tip + processing-cost offset).
- Card data never touches CharitMe servers or Supabase (Stripe Checkout hosts the form).

### Charge model note — destination vs. direct

The recipient-first *intent* of the spec (money is the recipient's, not CharitMe's) is
satisfied. However, the mechanism is a **destination charge**: the PaymentIntent is
created **on the platform account** and Stripe transfers the net to the connected
account. The spec's *preferred* mechanism is a **direct charge** (PaymentIntent created
**on** the connected account via the `Stripe-Account` header / `on_behalf_of`), which
generally shifts merchant-of-record, dispute, and refund-fee liability to the recipient.

Moving destination → direct is **architecturally and legally significant** (MoR status,
chargeback liability, refund-fee handling, per-country/payment-method availability). It
is tracked as a reviewed decision in `decisions.md` **ADR-P1**, is **not** a code defect,
and must not be switched without the documented written approval and Stripe **test-mode**
verification.

## Fee transparency

| Component | Who keeps it | Source of truth |
|---|---|---|
| Donation (`amountCents`) | Recipient connected account | `transfer_data.destination` |
| Platform tip (`tipCents`) | CharitMe (application fee) | `@shared/fees` `donorTip()`, server-computed |
| Processing coverage (`processingFeeCents`) | Offsets Stripe's cut so recipient nets full donation | `@shared/fees` `methodProcessingFee()` |

Fees are computed **server-side** from `@shared/fees`; the client cannot alter them (the
amount is re-derived on the server from `amountCents` + method, not trusted from the body).

## Idempotency

Checkout creation uses an idempotency key
`donation_<campaignId>_<amountCents>_<user|guest>_<requestKey>` so a duplicate submit
does not create duplicate sessions. Webhook processing idempotency is handled in
`app/api/stripe/webhook/route.ts` (see `record_donation` / webhook-event dedupe).

## Gaps / follow-ups (tracked, not yet done)

1. **Immutable double-entry ledger + daily Stripe reconciliation** (spec §1.7). A
   `donations` record + webhook stats exist; a formal reversing-entry ledger and an
   automated reconciliation job with exception incidents are not yet built. Needs Stripe
   **test** keys + a scheduled job.
2. **Direct-charge migration** — see ADR-P1; gated on legal/finance sign-off + test keys.
3. **Live money-flow test suite** (spec §8.1) — requires Stripe test clocks / sandbox
   connected accounts (test keys unavailable in this environment).
4. **Refund/dispute/negative-balance** operational workflows — partial; needs the ledger
   in (1) to be complete.
