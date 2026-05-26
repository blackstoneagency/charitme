import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── One-time donation completed ────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = (session.metadata ?? {}) as Record<string, string>;

    if (meta.campaignId) {
      // Donation checkout
      const amountCents = Number(meta.donationAmountCents ?? session.amount_total ?? 0);
      const tipCents = Number(meta.tipCents ?? 0);
      const processingFeeCents = Number(meta.processingFeeCents ?? 0);
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

      const { data, error } = await supabaseAdmin.rpc('record_donation', {
        p_stripe_event_id: event.id,
        p_campaign_id: meta.campaignId,
        p_donor_id: meta.donorId || null,
        p_amount_cents: amountCents,
        p_tip_cents: tipCents,
        p_processing_fee_cents: processingFeeCents,
        p_message: meta.message || null,
        p_anonymous: meta.anonymous === '1',
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
    } else if (meta.plan && meta.userId) {
      // Subscription checkout — provision plan immediately
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
      await supabaseAdmin
        .from('profiles')
        .update({
          plan: meta.plan,
          ...(customerId ? { stripe_customer_id: customerId } : {}),
          ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
        })
        .eq('id', meta.userId);
    }
  }

  // ── Subscription renewed / updated ────────────────────────────────────
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.userId;
    if (userId) {
      const planName = sub.metadata?.plan ?? 'free';
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      await supabaseAdmin
        .from('profiles')
        .update({ plan: isActive ? planName : 'free' })
        .eq('id', userId);
    }
  }

  // ── Subscription cancelled / expired ──────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === 'string' ? sub.customer : null;
    const userId = sub.metadata?.userId;
    if (userId) {
      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('id', userId);
    } else if (customerId) {
      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_customer_id', customerId);
    }
  }

  // ── Stripe Connect account verified ───────────────────────────────────
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
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

    if (account.details_submitted) {
      // Mark identity verified on the profile that owns this connected account
      const { data: row } = await supabaseAdmin
        .from('connected_accounts')
        .select('user_id')
        .eq('stripe_account_id', account.id)
        .single();
      if (row?.user_id) {
        await supabaseAdmin
          .from('profiles')
          .update({ identity_verified: true })
          .eq('id', row.user_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
