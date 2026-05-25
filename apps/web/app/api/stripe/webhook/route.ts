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

  const { data: existingEvent } = await supabaseAdmin
    .from('webhook_events')
    .select('id, processed_at')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existingEvent?.processed_at) return NextResponse.json({ ok: true });

  if (!existingEvent) {
    const { error: eventInsertError } = await supabaseAdmin.from('webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
    });

    if (eventInsertError) {
      return NextResponse.json({ error: 'Unable to record webhook event', code: 'WEBHOOK_EVENT_RECORD_FAILED' }, { status: 500 });
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { campaignId, donorId, message, anonymous } = session.metadata ?? {};

    if (!campaignId) {
      await supabaseAdmin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString(), processing_error: null })
        .eq('stripe_event_id', event.id);
      return NextResponse.json({ ok: true });
    }

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

      if (!existingDonation) {
        const { error: insertError } = await supabaseAdmin.from('donations').insert({
          campaign_id: campaignId,
          donor_id: donorId || null,
          amount_cents: amountCents,
          message: message || null,
          anonymous: anonymous === '1',
          stripe_payment_intent_id: paymentIntentId,
          status: 'completed',
        });

        if (insertError) {
          return NextResponse.json({ error: 'Unable to record donation', code: 'DONATION_RECORD_FAILED' }, { status: 500 });
        }
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from('donations').insert({
        campaign_id: campaignId,
        donor_id: donorId || null,
        amount_cents: amountCents,
        message: message || null,
        anonymous: anonymous === '1',
        stripe_payment_intent_id: null,
        status: 'completed',
      });

      if (insertError) {
        return NextResponse.json({ error: 'Unable to record donation', code: 'DONATION_RECORD_FAILED' }, { status: 500 });
      }
    }

    if (tipCents > 0) {
      const { data: existingTip } = paymentIntentId
        ? await supabaseAdmin.from('donor_tips').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
        : { data: null };

      if (!existingTip) {
        const { error: tipInsertError } = await supabaseAdmin.from('donor_tips').insert({
          campaign_id: campaignId,
          donor_id: donorId || null,
          amount_cents: tipCents,
          stripe_payment_intent_id: paymentIntentId,
        });

        if (tipInsertError) {
          return NextResponse.json({ error: 'Unable to record donor tip', code: 'DONOR_TIP_RECORD_FAILED' }, { status: 500 });
        }
      }
    }

    if (processingFeeCents > 0) {
      const { data: existingFee } = paymentIntentId
        ? await supabaseAdmin.from('platform_fees').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
        : { data: null };

      if (!existingFee) {
        const { error: feeInsertError } = await supabaseAdmin.from('platform_fees').insert({
          campaign_id: campaignId,
          amount_cents: processingFeeCents,
          fee_type: 'processing_fee_coverage',
          stripe_payment_intent_id: paymentIntentId,
        });

        if (feeInsertError) {
          return NextResponse.json({ error: 'Unable to record platform fee', code: 'PLATFORM_FEE_RECORD_FAILED' }, { status: 500 });
        }
      }
    }
  }

  const { error: eventUpdateError } = await supabaseAdmin
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), processing_error: null })
    .eq('stripe_event_id', event.id);

  if (eventUpdateError) {
    return NextResponse.json({ error: 'Unable to finalize webhook event', code: 'WEBHOOK_EVENT_UPDATE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
