import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder';

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
});

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
