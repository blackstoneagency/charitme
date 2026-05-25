import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { stripe } from '../../../lib/stripe';
import { platformFee, MIN_DONATION_CENTS, MAX_DONATION_CENTS } from '@shared/fees';
import { getAppOrigin } from '../../../lib/auth-config';

const DonateSchema = z.object({
  campaignId: z.string().uuid(),
  amountCents: z.number().int().min(MIN_DONATION_CENTS).max(MAX_DONATION_CENTS),
  message: z.string().max(500).optional(),
  anonymous: z.boolean().optional(),
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

  const { campaignId, amountCents, message, anonymous } = parsed.data;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug, status, user_id, profiles:user_id(stripe_account_id, stripe_onboarded)')
    .eq('id', campaignId)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found', code: 'NOT_FOUND' }, { status: 404 });
  if (campaign.status !== 'active') {
    return NextResponse.json({ error: 'Campaign is not active', code: 'CAMPAIGN_INACTIVE' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const fee = platformFee(amountCents);
  const origin = getAppOrigin();
  const profile = campaign.profiles as { stripe_account_id?: string; stripe_onboarded?: boolean } | null;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
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
    ],
    success_url: `${origin}/campaigns/${campaign.slug}?donated=1`,
    cancel_url: `${origin}/campaigns/${campaign.slug}`,
    metadata: {
      campaignId,
      donorId: user?.id ?? '',
      message: message ?? '',
      anonymous: anonymous ? '1' : '0',
    },
    payment_intent_data: {
      ...(profile?.stripe_onboarded && profile.stripe_account_id
        ? {
            application_fee_amount: fee,
            transfer_data: { destination: profile.stripe_account_id },
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
