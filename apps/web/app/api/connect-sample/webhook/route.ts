import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getStripeClient, getWebhookSecret, StripeConfigError } from '../../../../lib/connect-sample/client';

export const dynamic = 'force-dynamic';
// Stripe signature verification needs the raw body — force the Node runtime.
export const runtime = 'nodejs';

// ═════════════════════════════════════════════════════════════════════════════
// Webhook — thin events for V2 Connect accounts
//   POST /api/connect-sample/webhook
//
// V2 accounts emit "thin events" (just an id + type + a reference to the object).
// We verify the signature, then fetch the full object/event from the API to act
// on it. Configure your event destination to send at least:
//   • v2.core.account[requirements].updated
//   • v2.core.account[configuration.recipient].capability_status_updated
// ═════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  let stripeClient: ReturnType<typeof getStripeClient>;
  let webhookSecret: string;
  try {
    stripeClient = getStripeClient();
    webhookSecret = getWebhookSecret();
  } catch (err) {
    if (err instanceof StripeConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  // Raw body is required for signature verification.
  const payload = await request.text();

  let notification;
  try {
    // parseEventNotification handles thin events (throws if given a v1 snapshot).
    notification = await stripeClient.parseEventNotificationAsync(payload, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('[connect-sample webhook] verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (notification.type) {
      case 'v2.core.account[requirements].updated': {
        // The account's onboarding requirements changed — re-fetch the full
        // account to see whether onboarding is now complete.
        const account = await notification.fetchRelatedObject();
        const status = account?.requirements?.summary?.minimum_deadline?.status;
        const complete = status !== 'currently_due' && status !== 'past_due';
        console.log(
          `[connect-sample webhook] requirements updated for ${account?.id}: ` +
            `status=${status ?? 'none'}, onboardingComplete=${complete}`,
        );
        // In a real app: persist onboarding status against your user record here.
        break;
      }
      case 'v2.core.account[configuration.recipient].capability_status_updated': {
        // A recipient capability (e.g. stripe_transfers) changed status.
        const account = await notification.fetchRelatedObject();
        const transfersActive =
          account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers
            ?.status === 'active';
        console.log(
          `[connect-sample webhook] recipient capability updated for ${account?.id}: ` +
            `transfersActive=${transfersActive}`,
        );
        // In a real app: flip a "can receive payouts" flag on your user record.
        break;
      }
      default:
        // Acknowledge anything else so Stripe stops retrying.
        console.log(`[connect-sample webhook] unhandled event type: ${notification.type}`);
    }
  } catch (err) {
    // Log and 500 so Stripe retries — the signature was already valid.
    const message = err instanceof Error ? err.message : 'Handler error';
    console.error('[connect-sample webhook] handler error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
