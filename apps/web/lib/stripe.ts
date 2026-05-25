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
