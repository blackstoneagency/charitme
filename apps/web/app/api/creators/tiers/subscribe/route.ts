import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { boundedQuery } from '../../../../../lib/query-timeout';
import { createClient } from '../../../../../lib/supabase-server';
import { createCheckoutSession, RECURRING_PAYMENT_METHOD_TYPES } from '../../../../../lib/stripe';
import { resolvePayoutDestination, PayoutLookupUnavailableError } from '../../../../../lib/payout-destination';
import { getAppOrigin } from '../../../../../lib/auth-config';
import { checkRateLimit } from '../../../../../lib/rate-limit';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/creators/tiers/subscribe — buy a membership tier.
//
// The last missing piece of the creator module. `membership_tiers` and
// `member_subscriptions` have both been applied since 20260525002000, the tier
// CRUD ships, and `/creators/[handle]` renders the tiers — but the card said
// "memberships open soon" because nothing could take the money. That placeholder
// was the honest thing to show while this did not exist; it is what this route
// removes.
//
// Mirrors `/api/donations/recurring`: subscription-mode Checkout with an
// on-demand Price, so no Stripe dashboard setup is needed.
// ─────────────────────────────────────────────────────────────────────────────

const Schema = z.object({ tierId: z.string().uuid() });

/** Stripe intervals we can create a recurring Price for. */
const INTERVALS: Record<string, Stripe.PriceCreateParams.Recurring.Interval> = {
  month: 'month',
  monthly: 'month',
  year: 'year',
  yearly: 'year',
  annual: 'year',
  week: 'week',
  weekly: 'week',
};

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`membership:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  // A membership is tied to a person — it grants access to member-only posts, so
  // there has to be an account for that access to attach to.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to join a membership', code: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', code: 'INVALID_INPUT' }, { status: 400 });
  }

  // `.maybeSingle()`, not `.single()`: `.single()` reports "no rows" AS AN ERROR,
  // which would make a missing tier indistinguishable from an unreadable one and
  // send both down the same branch.
  const { data: tier, error: tierError } = await boundedQuery(() =>
    supabaseAdmin
      .from('membership_tiers')
      .select('id, title, description, amount_cents, interval, active, creator_profile_id')
      .eq('id', parsed.data.tierId)
      .maybeSingle(),
  );

  // A failed read is not a missing tier. Answering 404 here would tell someone a
  // real membership does not exist because a query timed out.
  if (tierError) {
    return NextResponse.json(
      { error: 'We could not start this membership right now. Please try again.', code: 'TIER_LOOKUP_UNAVAILABLE' },
      { status: 503 },
    );
  }
  if (!tier) {
    return NextResponse.json({ error: 'Membership tier not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  if (tier.active === false) {
    return NextResponse.json({ error: 'This tier is no longer available', code: 'TIER_INACTIVE' }, { status: 400 });
  }

  const { data: creator, error: creatorError } = await boundedQuery(() =>
    supabaseAdmin
      .from('creator_profiles')
      .select('id, handle, display_name, user_id')
      .eq('id', tier.creator_profile_id)
      .maybeSingle(),
  );
  if (creatorError) {
    return NextResponse.json(
      { error: 'We could not start this membership right now. Please try again.', code: 'CREATOR_LOOKUP_UNAVAILABLE' },
      { status: 503 },
    );
  }
  if (!creator) {
    return NextResponse.json({ error: 'Creator not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // CharitMe never holds the money. No payout destination, no subscription —
  // the same gate the donation routes apply, for the same reason: taking a
  // recurring payment we cannot forward would leave funds sitting with us.
  //
  // ⚠️ And "could not check" is not "not set up". `resolvePayoutDestination`
  // throws `PayoutLookupUnavailableError` when the lookup itself fails, which is
  // a DIFFERENT answer from a creator who has not onboarded: one is retryable,
  // the other is a fact about the creator. Every other payout-gated route
  // (donations, recurring, portfolio, tickets) separates them; this one let the
  // error escape as an unhandled 500, which fails safe on the money — no charge
  // is created — but tells the supporter nothing and buries the cause in a
  // generic error page.
  let destination: Awaited<ReturnType<typeof resolvePayoutDestination>>;
  try {
    destination = await resolvePayoutDestination({ user_id: creator.user_id as string });
  } catch (err) {
    if (err instanceof PayoutLookupUnavailableError) {
      return NextResponse.json(
        {
          error: 'We could not start this membership right now. Please try again.',
          code: 'PAYOUT_LOOKUP_UNAVAILABLE',
        },
        { status: 503 },
      );
    }
    throw err;
  }
  if (!destination) {
    return NextResponse.json(
      {
        error: 'This creator is completing secure payout setup and cannot accept memberships yet.',
        code: 'PAYOUT_NOT_READY',
      },
      { status: 409 },
    );
  }

  const interval = INTERVALS[String(tier.interval ?? 'month').toLowerCase()] ?? 'month';
  const origin = getAppOrigin();
  const creatorPath = `/creators/${creator.handle}`;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: RECURRING_PAYMENT_METHOD_TYPES,
    ...(user.email ? { customer_email: user.email } : {}),
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tier.title} — ${creator.display_name ?? creator.handle}`,
            ...(tier.description ? { description: String(tier.description) } : {}),
          },
          unit_amount: Number(tier.amount_cents),
          recurring: { interval },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}${creatorPath}?joined=1`,
    cancel_url: `${origin}${creatorPath}`,
    // `kind` is what the webhook branches on. Without it a membership session is
    // indistinguishable from a recurring DONATION session, and the handler would
    // write the wrong table.
    metadata: {
      kind: 'membership',
      tierId: String(tier.id),
      memberId: user.id,
      creatorProfileId: String(creator.id),
    },
    subscription_data: {
      metadata: {
        kind: 'membership',
        tierId: String(tier.id),
        memberId: user.id,
        creatorProfileId: String(creator.id),
      },
      // The creator receives the money; CharitMe takes no platform fee.
      transfer_data: { destination: destination.stripeAccountId },
    },
  };

  try {
    // Idempotency key ties the attempt to this member + tier, so a
    // double-clicked Join button cannot create two subscriptions.
    const session = await createCheckoutSession(params, `membership:${user.id}:${tier.id}`);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Stripe's own message can name internal configuration, so it is logged
    // rather than returned.
    console.error('[creators/tiers/subscribe] checkout failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'We could not start this membership right now. Please try again.', code: 'CHECKOUT_FAILED' },
      { status: 502 },
    );
  }
}
