import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { stripe } from '../../../lib/stripe';
import { donorTip, processingFee, MIN_DONATION_CENTS, MAX_DONATION_CENTS, DEFAULT_DONOR_TIP_PERCENT } from '@shared/fees';
import { getAppOrigin } from '../../../lib/auth-config';

const DonateSchema = z.object({
  campaignId: z.string().uuid(),
  amountCents: z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS),
  message: z.string().max(500).optional(),
  anonymous: z.boolean().optional(),
  coverProcessingFee: z.boolean().optional(),
  tipPercent: z.number().min(0).max(100).optional(),
  donorEmail: z.string().email().optional(), // used for guest donations
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = DonateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid donation request', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { campaignId, amountCents, message, anonymous, coverProcessingFee, donorEmail } = parsed.data;
  const tipPercent = parsed.data.tipPercent ?? Number(process.env.DEFAULT_DONOR_TIP_PERCENT ?? DEFAULT_DONOR_TIP_PERCENT);
  const tipCents = donorTip(amountCents, tipPercent);
  const processingFeeCents = coverProcessingFee ? processingFee(amountCents + tipCents) : 0;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, status, user_id')
    .eq('id', campaignId)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Campaign is not active', code: 'CAMPAIGN_INACTIVE' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const origin = getAppOrigin();
  const { data: connectedAccount } = await supabaseAdmin
    .from('connected_accounts')
    .select('stripe_account_id, payouts_enabled, details_submitted')
    .eq('user_id', campaign.user_id)
    .eq('verification_status', 'verified')
    .maybeSingle();
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
        product_data: { name: 'Optional CharitMe support tip' },
        unit_amount: tipCents,
      },
      quantity: 1,
    });
  }

  if (processingFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Optional processing fee coverage' },
        unit_amount: processingFeeCents,
      },
      quantity: 1,
    });
  }

  // Determine email for Stripe — authenticated user > provided guest email
  const stripeEmail = user?.email ?? donorEmail ?? undefined;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: lineItems,
    ...(stripeEmail ? { customer_email: stripeEmail } : {}),
    success_url: `${origin}/campaigns/${campaign.slug}?donated=1`,
    cancel_url: `${origin}/campaigns/${campaign.slug}`,
    metadata: {
      campaignId,
      donorId: user?.id ?? '',
      message: message ?? '',
      anonymous: anonymous ? '1' : '0',
      donationAmountCents: String(amountCents),
      tipCents: String(tipCents),
      processingFeeCents: String(processingFeeCents),
    },
    payment_intent_data: {
      ...(connectedAccount?.details_submitted && connectedAccount.payouts_enabled && connectedAccount.stripe_account_id
        ? {
            application_fee_amount: tipCents + processingFeeCents,
            transfer_data: { destination: connectedAccount.stripe_account_id },
          }
        : {}),
    },
  };

  const requestKey = request.headers.get('idempotency-key') ?? crypto.randomUUID();
  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: `donation_${campaignId}_${amountCents}_${user?.id ?? 'guest'}_${requestKey}`,
  });

  return NextResponse.json({ url: session.url });
}
