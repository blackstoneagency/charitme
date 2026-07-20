import 'server-only';
import Stripe from 'stripe';

// ═════════════════════════════════════════════════════════════════════════════
// Stripe Connect — sample integration (shared helpers)
//
// This file builds the single "Stripe Client" that EVERY sample request uses,
// per Stripe's guidance. We never pin an API version — the SDK automatically
// uses the version built into the installed `stripe` package.
// ═════════════════════════════════════════════════════════════════════════════

// PLACEHOLDER — REQUIRED.
//   Set STRIPE_SECRET_KEY to your Stripe *secret* key. Use a TEST key while
//   developing: it starts with `sk_test_...`. Find it in the Stripe Dashboard →
//   Developers → API keys. Put it in apps/web/.env.local (local) or your Vercel
//   project env vars (deployed), then restart the dev server.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();

let _client: Stripe | null = null;

/** Returns the shared Stripe Client, or throws a clear, actionable error. */
export function getStripeClient(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new StripeConfigError(
      'STRIPE_SECRET_KEY is not set. Add your Stripe secret key (sk_test_… for ' +
        'testing) to apps/web/.env.local or your Vercel environment variables, then ' +
        'restart. You can find it at https://dashboard.stripe.com/apikeys.',
    );
  }
  // Reuse one client across requests (the SDK is safe to share).
  // NOTE: no `apiVersion` is passed — the SDK picks the correct default itself.
  if (!_client) _client = new Stripe(STRIPE_SECRET_KEY);
  return _client;
}

/**
 * The webhook secret for the sample's event destination. Only required by the
 * webhook route. Create the destination in the Dashboard (Developers → Webhooks)
 * and copy its signing secret, or use the Stripe CLI which prints one.
 */
export function getWebhookSecret(): string {
  // PLACEHOLDER — REQUIRED for the webhook route only.
  //   Set STRIPE_CONNECT_WEBHOOK_SECRET (whsec_…). With the Stripe CLI, run:
  //   stripe listen --thin-events \
  //     'v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated' \
  //     --forward-thin-to localhost:3000/api/connect-sample/webhook
  //   …and copy the `whsec_…` it prints.
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new StripeConfigError(
      'STRIPE_CONNECT_WEBHOOK_SECRET is not set. Create a webhook/event destination ' +
        'in the Stripe Dashboard (or run `stripe listen …`) and set its signing ' +
        'secret (whsec_…) in your environment.',
    );
  }
  return secret;
}

/** The public base URL, used to build onboarding return/refresh + success URLs. */
export function baseUrl(): string {
  // Falls back to localhost for local dev. Set NEXT_PUBLIC_APP_URL in prod.
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Platform application fee for destination charges. The PLATFORM is the
 * fees-collector (see account creation), so we take a cut of each sale.
 * Here: a flat 5% — adjust to your own pricing model.
 */
export const APPLICATION_FEE_PERCENT = 5;
export function applicationFeeCents(amountCents: number): number {
  return Math.round((amountCents * APPLICATION_FEE_PERCENT) / 100);
}

/** Thrown when a required Stripe env var is missing — surfaced to the client. */
export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeConfigError';
  }
}
