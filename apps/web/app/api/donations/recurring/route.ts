import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { createCheckoutSession, RECURRING_PAYMENT_METHOD_TYPES } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { donorTip, MIN_DONATION_CENTS, MAX_DONATION_CENTS, DEFAULT_DONOR_TIP_PERCENT } from '@shared/fees';
import { normalizeCurrency } from '@shared/currencies';
import { resolvePayoutDestination } from '../../../../lib/payout-destination';
import { getAppOrigin } from '../../../../lib/auth-config';
import { checkRateLimit } from '../../../../lib/rate-limit';

const Schema = z.object({
  campaignId:   z.string().uuid(),
  amountCents:  z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS),
  cadence:      z.enum(['monthly', 'weekly', 'quarterly', 'annual']).default('monthly'),
  message:      z.string().max(500).optional(),
  anonymous:    z.boolean().optional(),
  tipPercent:   z.number().min(0).max(100).optional(),
  donorEmail:   z.string().email().optional(),
  utmSource:    z.string().max(100).optional(),
  utmMedium:    z.string().max(100).optional(),
  utmCampaign:  z.string().max(100).optional(),
  utmContent:   z.string().max(100).optional(),
  shareEventId: z.string().uuid().optional(),
  // Personal referral link (?ref=<userId>) — credits another user's referral rewards
  referrerId:   z.string().uuid().optional(),
  // "Subscribe to receive emails" checkbox — opts the donor into campaign update emails
  subscribeToUpdates: z.boolean().optional(),
});

// POST /api/donations/recurring
// Creates a Stripe Checkout session in subscription mode so the donor is
// billed on the chosen cadence. We use a per-campaign Stripe Price created
// on-demand so no manual Stripe dashboard setup is needed.
export async function POST(request: NextRequest) {
  // 10 recurring subscriptions per IP per 10 minutes
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`recurring:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { campaignId, amountCents, cadence, message, anonymous, donorEmail,
          utmSource, utmMedium, utmCampaign, utmContent, shareEventId, referrerId,
          subscribeToUpdates } = parsed.data;
  const tipPercent = parsed.data.tipPercent ?? DEFAULT_DONOR_TIP_PERCENT;
  const tipCents = donorTip(amountCents, tipPercent);

  // Verify campaign is active
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, status, user_id, beneficiary_profile_id, accept_donations, deadline')
    .eq('id', campaignId)
    .single();

  if (!campaign || campaign.status !== 'active') {
    return NextResponse.json({ error: campaign ? 'Campaign is not active' : 'Campaign not found' }, { status: 400 });
  }
  // Same gate as the one-time route: the organizer's "stop accepting donations"
  // switch was honoured by the UI but not by the API. Only an explicit `false`
  // blocks — the column defaults to true and is null on older rows.
  if ((campaign as { accept_donations?: boolean | null }).accept_donations === false) {
    return NextResponse.json({ error: 'This campaign is not accepting donations right now.', code: 'DONATIONS_CLOSED' }, { status: 400 });
  }

  // The campaign page renders "This campaign has ended." and hides the donate form
  // once the deadline passes, but the API never checked it — so a direct POST could
  // still donate to an ended campaign. Boundary matches the page exactly: it uses
  // Math.ceil((deadline - now)/day) > 0, which is false precisely when deadline <= now.
  const deadlineAt = (campaign as { deadline?: string | null }).deadline;
  if (deadlineAt && new Date(deadlineAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This campaign has ended.', code: 'CAMPAIGN_ENDED' }, { status: 400 });
  }

  // Campaign currency (defaults to USD)
  const { data: launchSettings } = await supabaseAdmin
    .from('campaign_launch_settings')
    .select('currency')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  const currency = normalizeCurrency(launchSettings?.currency).toLowerCase();

  const origin = getAppOrigin();
  const stripeEmail = user?.email ?? donorEmail ?? undefined;

  // ── Referral attribution ────────────────────────────────────────────────────
  // Donations made via a personal referral link (?ref=<userId>) create a
  // share_events row up front so the existing webhook conversion-tracking
  // logic (which marks share_events.converted + donation_id) applies unchanged.
  let referralShareEventId: string | undefined;
  if (referrerId && referrerId !== user?.id) {
    try {
      const { data: refEvent } = await supabaseAdmin
        .from('share_events')
        .insert({
          campaign_id: campaignId,
          sharer_id: referrerId,
          channel: 'link',
          utm_source: 'referral',
          utm_medium: 'referral-link',
          converted: false,
        })
        .select('id')
        .single();
      referralShareEventId = refEvent?.id;
    } catch (err) {
      console.warn('[donations/recurring] Failed to record referral share event:', err);
    }
  }

  // Map our cadence to Stripe interval
  const intervalMap: Record<string, Stripe.PriceCreateParams.Recurring.Interval> = {
    weekly: 'week',
    monthly: 'month',
    quarterly: 'month', // 3-month interval handled below
    annual: 'year',
  };
  const interval = intervalMap[cadence] ?? 'month';
  const intervalCount = cadence === 'quarterly' ? 3 : 1;

  // Total charged per period
  const totalPerPeriod = amountCents + tipCents;

  // Resolve payout destination (beneficiary first, then organizer).
  // CharitMe NEVER holds donation funds — no destination, no subscription.
  const destination = await resolvePayoutDestination(campaign);
  if (!destination) {
    return NextResponse.json(
      {
        error: 'This campaign cannot accept donations yet — the recipient is completing secure payout setup.',
        code: 'PAYOUT_NOT_READY',
      },
      { status: 409 },
    );
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    // Apple Pay / Google Pay (via card), Link, US bank transfer (ACH)
    payment_method_types: RECURRING_PAYMENT_METHOD_TYPES,
    ...(stripeEmail ? { customer_email: stripeEmail } : {}),
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: `Monthly support for: ${campaign.title}`,
            description: message ?? `Recurring ${cadence} donation`,
          },
          unit_amount: totalPerPeriod,
          recurring: { interval, interval_count: intervalCount },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/campaigns/${campaign.slug}?donated=1&recurring=1&amount=${amountCents}`,
    cancel_url: `${origin}/campaigns/${campaign.slug}`,
    metadata: {
      campaignId,
      donorId:              user?.id ?? '',
      message:              message ?? '',
      anonymous:            anonymous ? '1' : '0',
      donationAmountCents:  String(amountCents),
      tipCents:             String(tipCents),
      cadence,
      isRecurring:          '1',
      utmSource:            utmSource || (referralShareEventId ? 'referral' : ''),
      utmMedium:            utmMedium || (referralShareEventId ? 'referral-link' : ''),
      utmCampaign:          utmCampaign ?? '',
      utmContent:           utmContent ?? '',
      shareEventId:         referralShareEventId ?? shareEventId ?? '',
      currency,
      connectedAccountId:   destination.stripeAccountId,
      hasConnectedAccount:  '1',
      organizerUserId:      campaign.user_id,
      payoutRecipientId:    destination.recipientUserId,
      payoutRole:           destination.role,
      subscribeToUpdates:   subscribeToUpdates ? '1' : '0',
    },
    subscription_data: {
      metadata: {
        campaignId,
        donorId: user?.id ?? '',
        donorEmail: stripeEmail ?? '',
        anonymous: anonymous ? '1' : '0',
        donationAmountCents: String(amountCents),
        tipCents: String(tipCents),
        cadence,
        isRecurring: '1',
      },
      // Every recurring charge transfers straight to the recipient's account
      application_fee_percent: tipCents > 0 ? parseFloat(((tipCents / totalPerPeriod) * 100).toFixed(2)) : undefined,
      transfer_data: { destination: destination.stripeAccountId },
    },
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await createCheckoutSession(sessionParams, `recurring_${campaignId}_${user?.id ?? 'guest'}_${crypto.randomUUID()}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[donations/recurring] Stripe error:', msg);

    if (msg.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json({ error: 'Payment processing is not configured. Please contact support.' }, { status: 503 });
    }

    // Destination invalid — NEVER fall back to charging into the platform
    // balance (CharitMe must never hold funds). Block the subscription.
    if (msg.includes('No such destination') || msg.includes('account') || msg.includes('transfer')) {
      console.error('[donations/recurring] Destination account invalid — blocking subscription:', msg);
      return NextResponse.json(
        {
          error: 'This campaign cannot accept donations right now — the recipient\'s payout account needs attention.',
          code: 'PAYOUT_NOT_READY',
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ url: session!.url });
}
