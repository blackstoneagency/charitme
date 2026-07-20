import Stripe from 'stripe';
import { normalizeCurrency } from '@shared/currencies';

// Trim to tolerate a stray leading/trailing space or newline in the Vercel env
// value — a common cause of "STRIPE_SECRET_KEY is not set" in production.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || undefined;

function missingStripeEnv(): never {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe: Stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
    // API version is intentionally not pinned — the SDK uses its built-in
    // default (matching the installed stripe-node version).
    typescript: true,
  })
  : new Proxy({} as Stripe, {
    get() {
      return missingStripeEnv();
    },
  });

export function formatCents(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: normalizeCurrency(currency) }).format(cents / 100);
}

// ── Checkout payment methods ────────────────────────────────────────────────
// Stripe Checkout only shows alt payment methods (Apple Pay/Google Pay via the
// `card` wallet, Link, Cash App, US bank transfer/ACH, Amazon Pay, PayPal,
// BNPL via Klarna/Afterpay/Affirm) when they're explicitly listed here —
// without this, Checkout silently defaults to cards only. Methods the account
// hasn't activated (or that the session currency doesn't support) are stripped
// automatically by createCheckoutSession's retry logic.
export const ONE_TIME_PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
  'card',
  'link',
  'cashapp',
  'us_bank_account',
  'amazon_pay',
  'paypal',
  'klarna',
  'afterpay_clearpay',
  'affirm',
];

// Subscription-mode Checkout only supports payment methods that can be saved
// for off-session recurring charges.
export const RECURRING_PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
  'card',
  'link',
  'us_bank_account',
  'paypal',
];

/**
 * Create a Checkout Session, progressively stripping payment methods the
 * connected/platform Stripe account hasn't activated (or that the session's
 * currency/country doesn't support). Stripe reports the offending entry as
 * `payment_method_types[N]` — we remove just that method and retry, falling
 * back to card-only as a last resort so checkout never breaks.
 */
export async function createCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
  idempotencyKey: string,
): Promise<Stripe.Checkout.Session> {
  let attempt = { ...params };
  const maxRetries = (params.payment_method_types?.length ?? 1) + 1;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await stripe.checkout.sessions.create(attempt, { idempotencyKey: i === 0 ? idempotencyKey : `${idempotencyKey}_r${i}` });
    } catch (err: unknown) {
      const param = (err as Stripe.errors.StripeError | undefined)?.param;
      const types = attempt.payment_method_types;
      if (!param?.startsWith('payment_method_types') || !types?.length) throw err;

      const idxMatch = param.match(/^payment_method_types\[(\d+)\]/);
      const idx = idxMatch ? Number(idxMatch[1]) : -1;
      const remaining = idx >= 0 && idx < types.length && types[idx] !== 'card'
        ? types.filter((_, n) => n !== idx)
        : (['card'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[]);

      console.warn(`[stripe] Payment method rejected (${param}), retrying with: ${remaining.join(', ')}`);
      attempt = { ...attempt, payment_method_types: remaining };
    }
  }

  // Exhausted retries — final card-only attempt surfaces any real error
  return stripe.checkout.sessions.create(
    { ...attempt, payment_method_types: ['card'] },
    { idempotencyKey: `${idempotencyKey}_cardonly` },
  );
}
