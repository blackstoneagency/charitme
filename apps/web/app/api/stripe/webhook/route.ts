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

    const amountCents = session.amount_total ?? 0;

    await supabaseAdmin.from('donations').insert({
      campaign_id: campaignId,
      donor_id: donorId || null,
      amount_cents: amountCents,
      message: message || null,
      anonymous: anonymous === '1',
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      status: 'completed',
    });

    await supabaseAdmin.rpc('increment_campaign_stats', {
      p_campaign_id: campaignId,
      p_amount: amountCents,
    });
  }

  return NextResponse.json({ ok: true });
}
