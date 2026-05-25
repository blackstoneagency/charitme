import { NextResponse, type NextRequest } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';

export const config = { api: { bodyParser: false } };

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') ?? '';

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { campaignId, donorId, message, anonymous } = session.metadata ?? {};

    if (!campaignId) return NextResponse.json({ ok: true });

    const amountCents = Number(session.metadata?.donationAmountCents ?? session.amount_total ?? 0);
    const tipCents = Number(session.metadata?.tipCents ?? 0);
    const processingFeeCents = Number(session.metadata?.processingFeeCents ?? 0);
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    if (paymentIntentId) {
      const { data: existingDonation } = await supabaseAdmin
        .from('donations')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (existingDonation) return NextResponse.json({ ok: true });
    }

    const { error: insertError } = await supabaseAdmin.from('donations').insert({
      campaign_id: campaignId,
      donor_id: donorId || null,
      amount_cents: amountCents,
      message: message || null,
      anonymous: anonymous === '1',
      stripe_payment_intent_id: paymentIntentId,
      status: 'completed',
    });

    if (tipCents > 0) {
      await supabaseAdmin.from('donor_tips').insert({
        campaign_id: campaignId,
        donor_id: donorId || null,
        amount_cents: tipCents,
        stripe_payment_intent_id: paymentIntentId,
      });
    }

    if (processingFeeCents > 0) {
      await supabaseAdmin.from('platform_fees').insert({
        campaign_id: campaignId,
        amount_cents: processingFeeCents,
        fee_type: 'processing_fee_coverage',
        stripe_payment_intent_id: paymentIntentId,
      });
    }

    if (insertError) {
      return NextResponse.json({ error: 'Unable to record donation', code: 'DONATION_RECORD_FAILED' }, { status: 500 });
    }

    const { error: statsError } = await supabaseAdmin.rpc('increment_campaign_stats', {
      p_campaign_id: campaignId,
      p_amount: amountCents,
    });

    if (statsError) {
      return NextResponse.json({ error: 'Unable to update campaign totals', code: 'CAMPAIGN_STATS_FAILED' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
