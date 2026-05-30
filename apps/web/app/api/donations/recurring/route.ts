import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { donorTip, MIN_DONATION_CENTS, MAX_DONATION_CENTS, DEFAULT_DONOR_TIP_PERCENT } from '@shared/fees';
import { getAppOrigin } from '../../../../lib/auth-config';

const Schema = z.object({
  campaignId: z.string().uuid(),
  amountCents: z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS),
  cadence: z.enum(['monthly', 'weekly', 'quarterly', 'annual']).default('monthly'),
  message: z.string().max(500).optional(),
  anonymous: z.boolean().optional(),
  tipPercent: z.number().min(0).max(100).optional(),
  donorEmail: z.string().email().optional(),
});

// POST /api/donations/recurring
// Creates a Stripe Checkout session in subscription mode so the donor is
// billed on the chosen cadence. We use a per-campaign Stripe Price created
// on-demand so no manual Stripe dashboard setup is needed.
export async function POST(request: NextRequest) {
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

  const { campaignId, amountCents, cadence, message, anonymous, donorEmail } = parsed.data;
  const tipPercent = parsed.data.tipPercent ?? DEFAULT_DONOR_TIP_PERCENT;
  const tipCents = donorTip(amountCents, tipPercent);

  // Verify campaign is active
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, status, user_id')
    .eq('id', campaignId)
    .single();

  if (!campaign || campaign.status !== 'active') {
    return NextResponse.json({ error: campaign ? 'Campaign is not active' : 'Campaign not found' }, { status: 400 });
  }

  const origin = getAppOrigin();
  const stripeEmail = user?.email ?? donorEmail ?? undefined;

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

  // Get connected account if available
  const { data: connectedAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('stripe_account_id, payouts_enabled, details_submitted')
    .eq('user_id', campaign.user_id)
    .eq('verification_status', 'verified')
    .maybeSingle();

  const hasConnected = !!(connectedAccount?.details_submitted && connectedAccount.payouts_enabled);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    ...(stripeEmail ? { customer_email: stripeEmail } : {}),
    line_items: [
      {
        price_data: {
          currency: 'usd',
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
    success_url: `${origin}/campaigns/${campaign.slug}?donated=1&recurring=1`,
    cancel_url: `${origin}/campaigns/${campaign.slug}`,
    metadata: {
      campaignId,
      donorId: user?.id ?? '',
      message: message ?? '',
      anonymous: anonymous ? '1' : '0',
      donationAmountCents: String(amountCents),
      tipCents: String(tipCents),
      cadence,
      isRecurring: '1',
    },
    subscription_data: {
      metadata: {
        campaignId,
        donorId: user?.id ?? '',
        cadence,
        isRecurring: '1',
      },
      ...(hasConnected
        ? {
            application_fee_percent: tipCents > 0 ? parseFloat(((tipCents / totalPerPeriod) * 100).toFixed(2)) : undefined,
            transfer_data: { destination: connectedAccount!.stripe_account_id },
          }
        : {}),
    },
  };

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    console.error('[donations/recurring] Stripe error:', msg);

    if (msg.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json({ error: 'Payment processing is not configured. Please contact support.' }, { status: 503 });
    }

    // Connected account invalid — retry without transfer
    if (msg.includes('No such destination') || msg.includes('account') || msg.includes('transfer')) {
      console.warn('[donations/recurring] Falling back to direct charge:', msg);
      const fallbackParams = { ...sessionParams, payment_intent_data: {} };
      try {
        session = await stripe.checkout.sessions.create(fallbackParams);
      } catch (fe: unknown) {
        return NextResponse.json({ error: fe instanceof Error ? fe.message : 'Stripe error' }, { status: 502 });
      }
    } else {
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }
  return NextResponse.json({ url: session!.url });
}
