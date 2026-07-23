// Payment-method selection + checkout retry-recovery logic.
//
// Kept in its own module (with a TYPE-ONLY Stripe import, erased at runtime) so
// the pure `nextPaymentMethodTypes` helper can be unit-tested without loading the
// Stripe SDK, which fails under the Vitest ESM environment. lib/stripe.ts
// re-exports everything here for backward compatibility.
import type Stripe from 'stripe';

export type PaymentMethodType = Stripe.Checkout.SessionCreateParams.PaymentMethodType;

// NOTE: only methods ACTIVE on the platform Stripe account belong here. Stripe
// rejects the whole session if it contains an inactive method, and (see
// nextPaymentMethodTypes) the rejection often arrives without a method index, so
// a single inactive entry can otherwise collapse the session down to card-only —
// hiding every other valid method from the donor. Verified against the live
// account 2026-07-23: paypal_payments and affirm_payments are NOT active, so they
// are intentionally omitted. Re-add them here once activated in the Dashboard.
export const ONE_TIME_PAYMENT_METHOD_TYPES: PaymentMethodType[] = [
  'card',
  'link',
  'cashapp',
  'us_bank_account',
  'amazon_pay',
  'klarna',
  'afterpay_clearpay',
];

// Subscription-mode Checkout only supports payment methods that can be saved for
// off-session recurring charges. (paypal omitted — not active; see above.)
export const RECURRING_PAYMENT_METHOD_TYPES: PaymentMethodType[] = [
  'card',
  'link',
  'us_bank_account',
];

/**
 * Given a Stripe payment-method rejection, compute the payment_method_types to
 * retry with. Pure + exported so the (critical) donation-path recovery is unit
 * tested. Stripe reports the offending method either by index
 * (`payment_method_types[5]`) or, for inactive methods, only by name in the
 * message ("The payment method type provided: paypal is invalid") with a bare
 * `payment_method_types` param. Strip just that one method in either case so the
 * remaining valid methods survive, and only collapse to card-only when the
 * culprit genuinely cannot be identified.
 */
export function nextPaymentMethodTypes(
  types: PaymentMethodType[],
  param: string | null | undefined,
  message: string | null | undefined,
): PaymentMethodType[] {
  if (!types.length) return ['card'];
  const idx = Number(param?.match(/^payment_method_types\[(\d+)\]/)?.[1] ?? -1);
  if (idx >= 0 && idx < types.length && types[idx] !== 'card') {
    return types.filter((_, n) => n !== idx);
  }
  const named = message?.match(/payment method type(?: provided)?:?\s*["']?([a-z_]+)["']?/i)?.[1] as PaymentMethodType | undefined;
  if (named && named !== 'card' && types.includes(named)) {
    return types.filter((t) => t !== named);
  }
  return ['card'];
}
