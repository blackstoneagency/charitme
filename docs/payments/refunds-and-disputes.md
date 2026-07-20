# CharitMe — Refunds & Disputes (audited behavior)

> Audited from `apps/web/app/api/stripe/webhook/route.ts` against `master`.
> Describes as-built behavior with a documented limitation. Financial policy
> (fee retention on refund, chargeback liability) requires counsel sign-off —
> see `docs/compliance/review-required.md`.

## Refunds (`charge.refunded`) — `handleChargeRefunded`

On a Stripe `charge.refunded` event the webhook:

1. Loads the donation by `stripe_payment_intent_id`.
2. Sets `donations.status` = `refunded` (full) or leaves `completed` (partial),
   stamps `refunded_at`.
3. **Full refund only:** calls `decrement_campaign_stats(campaign, amount_cents)`
   to reverse the campaign's `raised_amount` / backer count.
4. Marks any matching `refunds` row `processed`.
5. Notifies the donor (full refund, non-blocking).
6. Updates `campaign_payments` → `refunded` / `partially_refunded` with
   `refunded_amount = charge.amount_refunded` (cumulative).
7. Upserts `campaign_payment_refunds` idempotently
   (`onConflict: processor,processor_object_id` = charge id).
8. Records a `charge.refunded` payment event.

**Idempotency:** the outer webhook layer skips already-processed `event.id`s, and
the refund/dispute writes use upserts keyed on the processor object id, so
duplicate delivery cannot create duplicate ledger rows.

### Known limitation (financial accuracy) — tracked, not yet changed

**Partial refunds do not adjust campaign `raised_amount`.** Only full refunds
call `decrement_campaign_stats`. A partially-refunded donation therefore still
counts its full gross toward the campaign's displayed "raised" figure, while the
true net is recoverable from `campaign_payments.refunded_amount`.

- **Why it's not a silent bug:** "raised" follows the common gross-pledged
  convention (GoFundMe shows gross), and the net is tracked per payment.
- **Correct remediation (needs Stripe-test verification before shipping):**
  decrement by the **delta** between the previously-recorded cumulative refund
  and `charge.amount_refunded` (never by the cumulative total, which would
  double-count across successive partial refunds). Requires storing the prior
  cumulative on the donation/payment and is a financial change that must be
  proven with Stripe test-clock fixtures — not applied blind.

## Disputes (`charge.dispute.created`) — `handleDisputeCreated`

1. Sets `donations.status` = `disputed`.
2. Inserts a `refunds` row representing the chargeback (`status: requested`,
   `stripe_refund_id = dispute.id`).
3. Writes an `audit_logs` entry.
4. Updates `campaign_payments` → `payment_status: disputed`,
   `dispute_status: opened`, `disputed_amount`, and crucially
   **`reconciliation_status: needs_review`** with `reconciliation_reason:
   dispute_opened` — routing the case into finance review.
5. Upserts `campaign_payment_disputes` idempotently (`onConflict` on dispute id).
6. Records a `charge.dispute.created` payment event.

`charge.dispute.closed` transitions the dispute to won/lost and updates the
payment/reconciliation state accordingly.

## Audit conclusion

Refund and dispute → ledger transitions are **correct, idempotent, and
reconciliation-aware**. No repair required. The single tracked limitation is
partial-refund campaign-stat accounting (above), deferred because a correct fix
is a financial change that must be verified against Stripe test clocks — which
needs Stripe **test** keys + staging (gated in this environment).

## Not verified here (gated)

- Live Stripe-test refund (full + successive partial) with test clocks.
- Dispute lifecycle created → closed(won/lost) financial state.
- Fee-retention-on-refund policy (application-fee reversal vs retention) — a
  business/legal decision to encode once approved.
