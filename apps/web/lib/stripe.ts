import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

function missingStripeEnv(): never {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe: Stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  })
  : new Proxy({} as Stripe, {
    get() {
      return missingStripeEnv();
    },
  });

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

// ── Checkout payment methods ────────────────────────────────────────────────
// Stripe Checkout only shows alt payment methods (Apple Pay/Google Pay via the
// `card` wallet, Link, Cash App, US bank transfer/ACH, Amazon Pay) when they're
// explicitly listed here — without this, Checkout silently defaults to cards only.
export const ONE_TIME_PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
  'card',
  'link',
  'cashapp',
  'us_bank_account',
  'amazon_pay',
];

// Subscription-mode Checkout only supports payment methods that can be saved
// for off-session recurring charges.
export const RECURRING_PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
  'card',
  'link',
  'us_bank_account',
];

/**
 * Create a Checkout Session, retrying with card-only payment methods if the
 * connected/platform Stripe account hasn't activated one of the requested
 * alternative payment methods yet.
 */
export async function createCheckoutSession(
  params: Stripe.Checkout.SessionCreateParams,
  idempotencyKey: string,
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create(params, { idempotencyKey });
  } catch (err: unknown) {
    const param = (err as Stripe.errors.StripeError | undefined)?.param;
    if (param?.startsWith('payment_method_types') && params.payment_method_types?.length) {
      console.warn('[stripe] Payment method not activated, retrying card-only:', (err as Error).message);
      return stripe.checkout.sessions.create(
        { ...params, payment_method_types: ['card'] },
        { idempotencyKey: `${idempotencyKey}_cardonly` },
      );
    }
    throw err;
  }
}
