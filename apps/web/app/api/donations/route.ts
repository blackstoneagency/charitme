import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { createClient } from '../../../lib/supabase-server';
import { createCheckoutSession, checkoutPaymentMethodTypes } from '../../../lib/stripe';
import {
  donorTip,
  supportPercentFromCents,
  methodProcessingFee,
  MIN_DONATION_CENTS,
  MAX_DONATION_CENTS,
  type PaymentMethod,
} from '@shared/fees';
import { normalizeCurrency } from '@shared/currencies';
import { resolvePayoutDestination, PayoutLookupUnavailableError } from '../../../lib/payout-destination';
import { getAppOrigin } from '../../../lib/auth-config';
import { checkRateLimit } from '../../../lib/rate-limit';
import { getSuspensionState } from '../../../lib/roles';
import { resolveContact, trackEvent } from '../../../lib/marketing-engine';
import { marketingStatusForOptIn } from '../../../lib/marketing-core';
import { getDonationCheckoutSnapshot } from '../../../lib/donation-checkout-settings';

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
  // Exact donor-entered support amount ("Enter custom amount"). Wins over
  // tipPercent so the donor is charged the figure they typed, to the cent —
  // round-tripping through a percentage would drift. Capped like a donation so a
  // crafted request can't submit an absurd tip.
  tipCents:           z.number().int().min(0).max(MAX_DONATION_CENTS).optional(),
  paymentMethod:      z.enum(['stripe','paypal','venmo','gpay','bank','card']).optional(),
  checkoutRevision:   z.string().trim().min(1).max(100).optional(),
  donorEmail:         z.string().email().optional(),
  // "Subscribe to receive emails" checkbox — opts the donor into campaign update emails
  subscribeToUpdates: z.boolean().optional(),
  // Peer-to-peer attribution: the supporter page this gift came through, when
  // the donor arrived via /campaigns/[slug]/team/[peerSlug]. Validated against
  // the campaign below — it is never trusted as given, because it decides who
  // gets credited for the money.
  peerFundraiserId:   z.string().uuid().optional(),
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
    subscribeToUpdates,
    peerFundraiserId,
    checkoutRevision,
  } = parsed.data;

  const checkout = await getDonationCheckoutSnapshot();
  if (checkoutRevision && checkoutRevision !== checkout.revision) {
    return NextResponse.json(
      { error: 'Donation pricing changed while this page was open. Refresh to review the current total.', code: 'CHECKOUT_CONFIG_CHANGED' },
      { status: 409 },
    );
  }

  // Normalise to a method Checkout actually offers, so the processing fee the
  // donor is quoted matches what they will really pay with.
  //
  // METHOD_FEES prices paypal at 3.49%+$0.49 and venmo at 1.9%+$0.10, but neither
  // is in ONE_TIME_PAYMENT_METHOD_TYPES — the account has paypal_payments
  // inactive (see lib/stripe-payment-methods.ts) — so such a donor is routed to
  // card regardless. The current UI offers only stripe/gpay/bank/card, so this is
  // unreachable from the app today; it protects against a stale cached client or a
  // hand-crafted POST quoting itself a rate it cannot use.
  //
  // These are REMAPPED rather than REJECTED on purpose: a 400 here would turn a
  // real donation attempt into an error, which is a worse outcome than a fee
  // rounding difference.
  const requestedMethod: PaymentMethod = parsed.data.paymentMethod ?? 'stripe';
  const paymentMethod: PaymentMethod =
    requestedMethod === 'paypal' || requestedMethod === 'venmo' ? 'card' : requestedMethod;
  // An exact custom support amount is authoritative; otherwise derive it from the
  // chosen tier percentage. Either way the charge below is built from tipCents,
  // so what the donor was shown is exactly what the card is charged.
  const customTipCents = parsed.data.tipCents;
  const usingCustomTip = customTipCents != null;
  const tipCents = usingCustomTip
    ? customTipCents
    : donorTip(amountCents, parsed.data.tipPercent ?? checkout.settings.defaultSupportPercent);
  // Display/metadata only — never used to recompute the charge.
  const tipPercent = usingCustomTip
    ? supportPercentFromCents(amountCents, tipCents)
    : (parsed.data.tipPercent ?? checkout.settings.defaultSupportPercent);

  // Use per-method fee on (donation + tip) sub-total
  const subTotalCents      = amountCents + tipCents;
  const processingFeeCents = coverProcessingFee
    ? methodProcessingFee(subTotalCents, paymentMethod, checkout.settings.methodFees)
    : 0;

  // ── Fetch campaign ──────────────────────────────────────────────────────────
  // `.maybeSingle()`, not `.single()`: `.single()` reports "no rows" AS AN ERROR,
  // which makes a missing campaign indistinguishable from an unreadable one. The
  // difference decides whether a donor is told their campaign does not exist.
  const { data: campaign, error: campaignError } = await boundedQuery(() =>
    supabaseAdmin
      .from('campaigns')
      .select('id, title, slug, status, user_id, beneficiary_profile_id, accept_donations, deadline')
      .eq('id', campaignId)
      .maybeSingle(),
  );

  // A failed read is NOT a missing campaign. This discarded `error` and answered
  // 404 "Campaign not found" — telling a donor mid-checkout that a live campaign
  // does not exist, because a query timed out or `supabaseAdmin`'s Proxy threw.
  // 503 is the honest answer and matches ACCOUNT_STATUS_UNAVAILABLE below: we
  // could not check, so we do not proceed and we ask them to retry.
  if (campaignError)
    return NextResponse.json({ error: 'We could not process this donation right now. Please try again.', code: 'CAMPAIGN_LOOKUP_UNAVAILABLE' }, { status: 503 });
  if (!campaign)
    return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
  if (campaign.status !== 'active')
    return NextResponse.json({ error: 'Campaign is not active', code: 'CAMPAIGN_INACTIVE' }, { status: 400 });
  // The organizer can switch donations off via /api/campaigns/donations-toggle.
  // The campaign page hides the donate button, but this route never checked the
  // flag, so a direct POST still took money after they had explicitly said stop.
  // Compared against `false` specifically: the column defaults to true and is null
  // on older rows, and neither should block a campaign that never opted out.
  if ((campaign as { accept_donations?: boolean | null }).accept_donations === false)
    return NextResponse.json({ error: 'This campaign is not accepting donations right now.', code: 'DONATIONS_CLOSED' }, { status: 400 });

  // The organizer's account status. Suspension was displayed in the admin console
  // and enforced nowhere, so the realistic failure was: trust & safety suspends a
  // fraudulent fundraiser, the console reads "Suspended", and the money keeps
  // arriving. Not creating campaigns and not receiving donations are the two
  // actions a suspended account unambiguously must not perform.
  //
  // The donor is not the suspended party, so the copy stays neutral — it does not
  // disclose a moderation decision about a third party to whoever hits this route.
  const organizerSuspension = await getSuspensionState(campaign.user_id);
  if (organizerSuspension === 'suspended')
    return NextResponse.json({ error: 'This campaign is not accepting donations right now.', code: 'DONATIONS_CLOSED' }, { status: 400 });
  if (organizerSuspension === 'unknown')
    return NextResponse.json({ error: 'We could not process this donation right now. Please try again.', code: 'ACCOUNT_STATUS_UNAVAILABLE' }, { status: 503 });

  // The campaign page renders "This campaign has ended." and hides the donate form
  // once the deadline passes, but the API never checked it — so a direct POST could
  // still donate to an ended campaign. Boundary matches the page exactly: it uses
  // Math.ceil((deadline - now)/day) > 0, which is false precisely when deadline <= now.
  const deadlineAt = (campaign as { deadline?: string | null }).deadline;
  if (deadlineAt && new Date(deadlineAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This campaign has ended.', code: 'CAMPAIGN_ENDED' }, { status: 400 });
  }

  // ── Peer-to-peer attribution ────────────────────────────────────────────────
  //
  // Verified against THIS campaign before it goes anywhere near Stripe metadata.
  // An unverified id would let a crafted POST credit any supporter on the
  // platform for a gift to an unrelated campaign — the peer's public total is a
  // fundraising leaderboard, so that is a real incentive to forge.
  //
  // A bad id is dropped to NULL rather than rejected: the donor is trying to
  // give money, and refusing the whole donation over a stale link would be a
  // worse outcome than recording it as a direct gift. `record_donation` repeats
  // this same check server-side — belt and braces, because that function runs
  // SECURITY DEFINER and metadata is client-influenced.
  //
  // ⚠️ The reasoning above is about a STALE OR FORGED id, and it is right about
  // that. It does not cover a failed READ, and this lookup discarded its `error`
  // so the two were the same thing: `null`.
  //
  // The consequence is not recoverable. Only the VERIFIED id reaches Stripe
  // metadata (see below), so a dropped one is gone — the webhook has nothing to
  // re-check, `record_donation` receives NULL, and a gift given through a
  // supporter's team page is permanently recorded as a direct donation. Their
  // total never moves, which is exactly the dead progress bar the peer page
  // warns about.
  //
  // Refusing the donation is still the wrong answer. So on a read failure the
  // REQUESTED id is passed through instead, because the check here is belt and
  // braces: `record_donation` re-runs the identical rule server-side
  // (`id = p_peer_fundraiser_id and parent_campaign_id = p_campaign_id`,
  // 20260816000000) under SECURITY DEFINER and drops it to NULL if it does not
  // check out. So nothing is trusted that was not already going to be verified —
  // the authoritative gate is unchanged.
  let peerIdToRecord: string | null = null;
  if (peerFundraiserId) {
    const { data: peer, error: peerError } = await boundedQuery(() =>
      supabaseAdmin
        .from('peer_fundraisers')
        .select('id')
        // `parent_campaign_id`, not `campaign_id` — this table is the exception.
        .eq('id', peerFundraiserId)
        .eq('parent_campaign_id', campaignId)
        .maybeSingle(),
    );
    if (peerError) {
      console.error('[donations] peer verification unavailable, deferring to record_donation:', {
        campaignId, peerFundraiserId, code: peerError.code, message: peerError.message,
      });
      peerIdToRecord = peerFundraiserId;
    } else {
      peerIdToRecord = (peer as { id: string } | null)?.id ?? null;
    }
  }

  // ── Campaign currency (defaults to USD) ─────────────────────────────────────
  //
  // ⚠️ The default is only safe when the row was genuinely READ. `normalizeCurrency`
  // maps anything unrecognised — including `undefined` — to USD, so a discarded
  // error here silently charged a GBP or EUR campaign's donor in DOLLARS. That is
  // a wrong amount taken from a real card, not a display glitch, and it is
  // invisible afterwards because the donation records the currency it charged.
  //
  // "No row" still legitimately means USD: campaigns without launch settings are
  // the default-currency case. Only a genuine read FAILURE stops the checkout.
  const { data: launchSettings, error: launchSettingsError } = await boundedQuery(() =>
    supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', campaignId)
      .maybeSingle(),
  );
  if (launchSettingsError)
    return NextResponse.json({ error: 'We could not process this donation right now. Please try again.', code: 'CURRENCY_LOOKUP_UNAVAILABLE' }, { status: 503 });
  const currency = normalizeCurrency(launchSettings?.currency).toLowerCase();

  // ── Reward / perk tier validation ───────────────────────────────────────────
  if (rewardId) {
    const { data: reward, error: rewardError } = await boundedQuery(() =>
      supabaseAdmin
        .from('campaign_rewards')
        .select('id, campaign_id, amount_cents, item_limit, claimed_count')
        .eq('id', rewardId)
        .maybeSingle(),
    );

    // Same distinction as the campaign lookup. Answering "Reward not found" on an
    // unreadable row is worse than it looks: the donor picked a real perk, and the
    // obvious recovery is to retry WITHOUT it — completing a donation that quietly
    // drops the reward they chose.
    if (rewardError)
      return NextResponse.json({ error: 'We could not process this donation right now. Please try again.', code: 'REWARD_LOOKUP_UNAVAILABLE' }, { status: 503 });
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

  // ── Resolve payout destination (beneficiary first, then organizer) ──────────
  // CharitMe NEVER holds donation funds: every charge is a destination charge
  // straight to the recipient's own Stripe account. No destination → no charge.
  // A failed readiness lookup must NOT be answered as "not set up yet", and must
  // never fall through to a different recipient — see PayoutLookupUnavailableError.
  let destination;
  try {
    destination = await resolvePayoutDestination(campaign);
  } catch (err) {
    if (err instanceof PayoutLookupUnavailableError) {
      return NextResponse.json(
        {
          error: 'We could not verify the recipient just now. Nothing was charged — please try again.',
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
        error: 'This campaign cannot accept donations yet — the recipient is completing secure payout setup.',
        code: 'PAYOUT_NOT_READY',
      },
      { status: 409 },
    );
  }

  // ── Build Stripe Checkout line items ────────────────────────────────────────
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency,
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
        currency,
        product_data: {
          name: 'CharitMe fee',
          description: usingCustomTip
            ? 'Custom optional tip to support CharitMe'
            : `${tipPercent}% optional tip to support CharitMe`,
        },
        unit_amount: tipCents,
      },
      quantity: 1,
    });
  }

  if (processingFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency,
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
  //                     so the recipient always receives exactly amountCents
  //
  // transfer_data.destination → Stripe automatically transfers amountCents
  //   to the recipient's connected account (beneficiary if set, otherwise the
  //   organizer) when the charge is captured — CharitMe never holds the funds.
  //
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: checkoutPaymentMethodTypes(paymentMethod, 'payment'),
    line_items: lineItems,
    ...(stripeEmail ? { customer_email: stripeEmail } : {}),
    // Routed to /thank-you with the SESSION id, not the amount. The old URL
    // carried ?amount=, which is visitor-editable — the thank-you page would have
    // been rendering an official-looking receipt for a number nobody verified.
    // The session id is exchanged server-side for the real donation row.
    success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}&campaign=${campaign.slug}`,
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
      checkoutRevision: checkout.revision,
      // '' rather than omitted: Stripe metadata values must be strings, and the
      // webhook reads `meta.peerFundraiserId || null`.
      peerFundraiserId:     peerIdToRecord ?? '',
      // Connected account info (so webhook knows routing without extra DB lookup)
      connectedAccountId:   destination.stripeAccountId,
      hasConnectedAccount:  '1',
      organizerUserId:      campaign.user_id,
      payoutRecipientId:    destination.recipientUserId,
      payoutRole:           destination.role,
      // Share attribution
      utmSource:            utmSource || (referralShareEventId ? 'referral' : ''),
      utmMedium:            utmMedium || (referralShareEventId ? 'referral-link' : ''),
      utmCampaign:          utmCampaign ?? '',
      utmContent:           utmContent ?? '',
      shareEventId:         referralShareEventId ?? shareEventId ?? '',
      rewardId:             rewardId ?? '',
      currency,
      subscribeToUpdates:   subscribeToUpdates ? '1' : '0',
    },
    payment_intent_data: {
      // CharitMe keeps tip + processing coverage; recipient gets amountCents
      application_fee_amount: tipCents + processingFeeCents,
      transfer_data: { destination: destination.stripeAccountId },
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

    // Destination account invalid — NEVER fall back to charging into the
    // platform balance (CharitMe must never hold funds). Block the donation
    // and surface a payout-setup error instead.
    if (
      msg.includes('No such destination') ||
      msg.includes('account') ||
      msg.includes('transfer')
    ) {
      console.error('[donations] Destination account invalid — blocking donation:', msg);
      return NextResponse.json(
        {
          error: 'This campaign cannot accept donations right now — the recipient\'s payout account needs attention.',
          code: 'PAYOUT_NOT_READY',
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Could not start secure checkout. Please try again.', code: 'STRIPE_ERROR' },
      { status: 502 },
    );
  }

  // Marketing capture: donation_started event for abandoned-donation automations (non-blocking).
  // The "Subscribe to receive emails" checkbox is honored here at contact
  // creation so a non-opted-in donor is never created as an emailable contact.
  try {
    const captureEmail = user?.email ?? donorEmail;
    if (captureEmail) {
      const contactId = await resolveContact({
        email: captureEmail,
        userId: user?.id,
        clientType: 'donor',
        consentEmail: !!subscribeToUpdates,
        consentSource: 'donation_checkout',
        marketingStatus: marketingStatusForOptIn(!!subscribeToUpdates),
      });
      if (contactId) {
        await trackEvent({
          contactId,
          eventType: 'donation_started',
          campaignId,
          amountCents,
        });
      }
    }
  } catch { /* capture must never block checkout */ }

  return NextResponse.json({ url: session!.url });
}
