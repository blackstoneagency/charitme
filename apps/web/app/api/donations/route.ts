import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { createCheckoutSession, ONE_TIME_PAYMENT_METHOD_TYPES } from '../../../lib/stripe';
import {
  donorTip,
  methodProcessingFee,
  MIN_DONATION_CENTS,
  MAX_DONATION_CENTS,
  DEFAULT_DONOR_TIP_PERCENT,
  type PaymentMethod,
} from '@shared/fees';
import { getAppOrigin } from '../../../lib/auth-config';
import { checkRateLimit } from '../../../lib/rate-limit';

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────
const DonateSchema = z.object({
  campaignId:         z.string().uuid(),
  amountCents:        z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS),
  message:            z.string().max(500).optional(),
  anonymous:          z.boolean().optional(),
  coverProcessingFee: z.boolean().optional(),
  tipPercent:         z.number().min(0).max(100).optional(),
  paymentMethod:      z.enum(['stripe','paypal','venmo','gpay','bank','card']).optional(),
  donorEmail:         z.string().email().optional(),
  // Share attribution — UTM params forwarded from the landing URL
  utmSource:          z.string().max(100).optional(),
  utmMedium:          z.string().max(100).optional(),
  utmCampaign:        z.string().max(100).optional(),
  utmContent:         z.string().max(100).optional(),
  shareEventId:       z.string().uuid().optional(),
  // Personal referral link (?ref=<userId>) — credits another user's referral rewards
  referrerId:         z.string().uuid().optional(),
  // Reward / perk tier selected at checkout (Kickstarter-style)
  rewardId:           z.string().uuid().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/donations
//
// Split-payment flow (Stripe Connect Destination Charges):
//
//   Donor pays:  $100 (donation) + $8 (8% tip) + $3.43 (processing) = $111.43
//   ┌─────────────────────────────────────────────────────────────────┐
//   │  application_fee_amount = tipCents + processingFeeCents         │
//   │  → CharitMe keeps: tipCents ($8) net of Stripe's processing fee │
//   │  transfer_data.destination = organizer's Stripe account         │
//   │  → Organizer receives: amountCents ($100) automatically         │
//   └─────────────────────────────────────────────────────────────────┘
//
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // 20 donations per IP per 10 minutes — prevents spam / card testing
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`donate:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = DonateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid donation request', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    campaignId,
    amountCents,
    message,
    anonymous,
    coverProcessingFee,
    donorEmail,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    shareEventId,
    referrerId,
    rewardId,
  } = parsed.data;

  const paymentMethod: PaymentMethod = parsed.data.paymentMethod ?? 'stripe';
  const tipPercent    = parsed.data.tipPercent ?? Number(process.env.DEFAULT_DONOR_TIP_PERCENT ?? DEFAULT_DONOR_TIP_PERCENT);
  const tipCents      = donorTip(amountCents, tipPercent);

  // Use per-method fee on (donation + tip) sub-total
  const subTotalCents      = amountCents + tipCents;
  const processingFeeCents = coverProcessingFee ? methodProcessingFee(subTotalCents, paymentMethod) : 0;

  // ── Fetch campaign ──────────────────────────────────────────────────────────
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, status, user_id')
    .eq('id', campaignId)
    .single();

  if (!campaign)
    return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
  if (campaign.status !== 'active')
    return NextResponse.json({ error: 'Campaign is not active', code: 'CAMPAIGN_INACTIVE' }, { status: 400 });

  // ── Reward / perk tier validation ───────────────────────────────────────────
  if (rewardId) {
    const { data: reward } = await supabaseAdmin
      .from('campaign_rewards')
      .select('id, campaign_id, amount_cents, item_limit, claimed_count')
      .eq('id', rewardId)
      .single();

    if (!reward || reward.campaign_id !== campaignId)
      return NextResponse.json({ error: 'Reward not found', code: 'REWARD_NOT_FOUND' }, { status: 404 });
    if (amountCents < reward.amount_cents)
      return NextResponse.json({ error: 'Donation amount is below the minimum for this reward', code: 'REWARD_MIN_NOT_MET' }, { status: 400 });
    if (reward.item_limit != null && reward.claimed_count >= reward.item_limit)
      return NextResponse.json({ error: 'This reward is sold out', code: 'REWARD_SOLD_OUT' }, { status: 400 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const stripeEmail = user?.email ?? donorEmail ?? undefined;

  const origin = getAppOrigin();

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
      console.warn('[donations] Failed to record referral share event:', err);
    }
  }

  // ── Look up organizer's connected Stripe account ────────────────────────────
  const { data: connectedAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('stripe_account_id, payouts_enabled, details_submitted, charges_enabled')
    .eq('user_id', campaign.user_id)
    .eq('verification_status', 'verified')
    .maybeSingle();

  const hasConnectedAccount =
    !!connectedAccount?.details_submitted &&
    !!connectedAccount.payouts_enabled &&
    !!connectedAccount.charges_enabled &&
    !!connectedAccount.stripe_account_id;

  // ── Build Stripe Checkout line items ────────────────────────────────────────
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Donation to: ${campaign.title}`,
          description: message ?? undefined,
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    },
  ];

  if (tipCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'CharitMe platform tip', description: `${tipPercent}% optional tip to support CharitMe` },
        unit_amount: tipCents,
      },
      quantity: 1,
    });
  }

  if (processingFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Payment processing fee', description: `Covers ${paymentMethod} processing costs` },
        unit_amount: processingFeeCents,
      },
      quantity: 1,
    });
  }

  // ── Stripe session params ───────────────────────────────────────────────────
  //
  // application_fee_amount = tipCents + processingFeeCents
  //   • tipCents      → CharitMe's revenue (8% donor tip)
  //   • processingFee → offsets Stripe's deduction from CharitMe's balance
  //                     so the organizer always receives exactly amountCents
  //
  // transfer_data.destination → Stripe automatically transfers amountCents
  //   to the organizer's connected account when the charge is captured.
  //
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    // Apple Pay / Google Pay (via card), Link, Cash App, US bank transfer (ACH), Amazon Pay
    payment_method_types: ONE_TIME_PAYMENT_METHOD_TYPES,
    line_items: lineItems,
    ...(stripeEmail ? { customer_email: stripeEmail } : {}),
    success_url: `${origin}/campaigns/${campaign.slug}?donated=1`,
    cancel_url:  `${origin}/campaigns/${campaign.slug}`,
    metadata: {
      // Core fields
      campaignId,
      donorId:              user?.id ?? '',
      message:              message ?? '',
      anonymous:            anonymous ? '1' : '0',
      // Split breakdown — stored for webhook + audit log
      donationAmountCents:  String(amountCents),
      tipCents:             String(tipCents),
      tipPercent:           String(tipPercent),
      processingFeeCents:   String(processingFeeCents),
      platformFeeCents:     String(tipCents),            // CharitMe's actual revenue
      paymentMethod,
      // Connected account info (so webhook knows routing without extra DB lookup)
      connectedAccountId:   connectedAccount?.stripe_account_id ?? '',
      hasConnectedAccount:  hasConnectedAccount ? '1' : '0',
      organizerUserId:      campaign.user_id,
      // Share attribution
      utmSource:            utmSource || (referralShareEventId ? 'referral' : ''),
      utmMedium:            utmMedium || (referralShareEventId ? 'referral-link' : ''),
      utmCampaign:          utmCampaign ?? '',
      utmContent:           utmContent ?? '',
      shareEventId:         referralShareEventId ?? shareEventId ?? '',
      rewardId:             rewardId ?? '',
    },
    payment_intent_data: hasConnectedAccount
      ? {
          // CharitMe keeps tip + processing coverage; organizer gets amountCents
          application_fee_amount: tipCents + processingFeeCents,
          transfer_data: { destination: connectedAccount!.stripe_account_id },
        }
      : {
          // No connected account — full amount stays in CharitMe's platform account
          // Admin will need to manually pay out to the organizer
        },
  };

  const requestKey  = request.headers.get('idempotency-key') ?? crypto.randomUUID();
  const idempotencyKey = `donation_${campaignId}_${amountCents}_${user?.id ?? 'guest'}_${requestKey}`;

  let session: Stripe.Checkout.Session;
  try {
    session = await createCheckoutSession(sessionParams, idempotencyKey);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[donations] Stripe error:', msg);

    if (msg.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json(
        { error: 'Payment processing is not configured. Please contact support.' },
        { status: 503 },
      );
    }

    // Connected account invalid — fall back to direct charge (no split)
    if (
      msg.includes('No such destination') ||
      msg.includes('account') ||
      msg.includes('transfer')
    ) {
      console.warn('[donations] Falling back to direct charge — connected account invalid:', msg);
      const fallbackParams: Stripe.Checkout.SessionCreateParams = {
        ...sessionParams,
        payment_intent_data: {},
        metadata: {
          ...sessionParams.metadata,
          hasConnectedAccount: '0',
          connectedAccountId: '',
          fallback: '1',
        },
      };
      try {
        session = await createCheckoutSession(fallbackParams, `${idempotencyKey}_fallback`);
      } catch (fallbackErr: unknown) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : 'Stripe error';
        return NextResponse.json({ error: fallbackMsg }, { status: 502 });
      }
    } else {
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ url: session!.url });
}
