import { NextResponse, type NextRequest } from 'next/server';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';

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
    const session = event.data.object as {
      id: string;
      payment_intent: string | null;
      amount_total: number | null;
      metadata: Record<string, string> | null;
    };
    const meta = session.metadata ?? {};
    const { campaignId, donorId, message, anonymous } = meta;

    if (campaignId) {
      const amountCents = Number(meta.donationAmountCents ?? session.amount_total ?? 0);
      const tipCents = Number(meta.tipCents ?? 0);
      const processingFeeCents = Number(meta.processingFeeCents ?? 0);
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

      const { data, error } = await supabaseAdmin.rpc('record_donation', {
        p_stripe_event_id: event.id,
        p_campaign_id: campaignId,
        p_donor_id: donorId || null,
        p_amount_cents: amountCents,
        p_tip_cents: tipCents,
        p_processing_fee_cents: processingFeeCents,
        p_message: message || null,
        p_anonymous: anonymous === '1',
        p_stripe_payment_intent_id: paymentIntentId,
        p_stripe_checkout_session_id: session.id,
      });

      if (error) {
        console.error('record_donation failed', error.code);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      if ((data as { status: string } | null)?.status === 'already_processed') {
        return NextResponse.json({ ok: true });
      }
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as {
      id: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      details_submitted: boolean;
    };
    await supabaseAdmin
      .from('connected_accounts')
      .update({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        verification_status: account.details_submitted ? 'verified' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', account.id);
  }

  return NextResponse.json({ ok: true });
}
