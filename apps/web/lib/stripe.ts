import Stripe from 'stripe';

// Re-exported for backward compatibility. `formatCents` is client-safe and now
// lives in @shared/currencies so client components can format money without
// pulling the server-only Stripe SDK into their bundle. Prefer importing it
// directly from '@shared/currencies' in new code.
export { formatCents } from '@shared/currencies';

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


// ── Checkout payment methods ────────────────────────────────────────────────
// Stripe Checkout only shows alt payment methods (Apple Pay/Google Pay via the
// `card` wallet, Link, Cash App, US bank transfer/ACH, Amazon Pay, PayPal,
// BNPL via Klarna/Afterpay/Affirm) when they're explicitly listed here —
// without this, Checkout silently defaults to cards only. Methods the account
// hasn't activated (or that the session currency doesn't support) are stripped
// automatically by createCheckoutSession's retry logic.
// Payment-method lists + retry-recovery logic live in an SDK-free module so the
// recovery logic can be unit tested without loading the Stripe SDK. Re-exported
// here so existing `import { ... } from './stripe'` call sites keep working.
export {
  ONE_TIME_PAYMENT_METHOD_TYPES,
  RECURRING_PAYMENT_METHOD_TYPES,
  nextPaymentMethodTypes,
} from './stripe-payment-methods';
import { nextPaymentMethodTypes } from './stripe-payment-methods';

/**
 * Create a Checkout Session, progressively stripping payment methods the
 * connected/platform Stripe account hasn't activated (or that the session's
 * currency/country doesn't support), falling back to card-only as a last resort
 * so checkout never breaks. See nextPaymentMethodTypes for the strip logic.
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
      const stripeErr = err as Stripe.errors.StripeError | undefined;
      const param = stripeErr?.param;
      const types = attempt.payment_method_types;
      if (!param?.startsWith('payment_method_types') || !types?.length) throw err;

      const remaining = nextPaymentMethodTypes(types, param, stripeErr?.message);
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
