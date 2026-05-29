import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe, formatCents } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';
import { sendReceiptEmail } from '../../../../lib/email';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── checkout.session.completed ────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = (session.metadata ?? {}) as Record<string, string>;

    if (meta.campaignId && meta.isRecurring === '1') {
      // ── Recurring donation first payment ──────────────────────────────────
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
      const amountCents = Number(meta.donationAmountCents ?? 0);
      const tipCents = Number(meta.tipCents ?? 0);

      if (subscriptionId && amountCents > 0) {
        // Record the first donation as a standard completed donation
        try {
          await supabaseAdmin.rpc('record_donation', {
            p_stripe_event_id: event.id,
            p_campaign_id: meta.campaignId,
            p_donor_id: meta.donorId || null,
            p_amount_cents: amountCents,
            p_tip_cents: tipCents,
            p_processing_fee_cents: 0,
            p_message: meta.message || null,
            p_anonymous: meta.anonymous === '1',
            p_stripe_payment_intent_id: null,
            p_stripe_checkout_session_id: session.id,
          });
        } catch { /* non-fatal */ }

        // Upsert recurring_donations row
        try {
          await supabaseAdmin
            .from('recurring_donations')
            .upsert({
              donor_id: meta.donorId || null,
              campaign_id: meta.campaignId,
              amount_cents: amountCents,
              cadence: meta.cadence ?? 'monthly',
              status: 'active',
              stripe_subscription_id: subscriptionId,
              next_bill_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: 'stripe_subscription_id', ignoreDuplicates: false });
        } catch { /* non-fatal */ }

        // Send receipt
        if (meta.donorId) {
          void (async () => {
            try {
              const [{ data: profile }, { data: camp }] = await Promise.all([
                supabaseAdmin.from('profiles').select('full_name, email').eq('id', meta.donorId).single(),
                supabaseAdmin.from('campaigns').select('title, slug').eq('id', meta.campaignId).single(),
              ]);
              if (profile?.email && camp) {
                await sendReceiptEmail({
                  to: profile.email,
                  donorName: profile.full_name,
                  campaignTitle: camp.title,
                  campaignSlug: camp.slug,
                  amountFormatted: `${formatCents(amountCents)}/month`,
                });
              }
            } catch { /* silent */ }
          })();
        }
      }
    } else if (meta.campaignId) {
      // ── One-time donation ──────────────────────────────────────────────────
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

      const donorId = meta.donorId;
      if (donorId && amountCents > 0) {
        void (async () => {
          try {
            const [{ data: donorProfile }, { data: campaignData }] = await Promise.all([
              supabaseAdmin.from('profiles').select('full_name, email').eq('id', donorId).single(),
              supabaseAdmin.from('campaigns').select('title, slug').eq('id', meta.campaignId).single(),
            ]);
            if (donorProfile?.email && campaignData) {
              await sendReceiptEmail({
                to: donorProfile.email,
                donorName: donorProfile.full_name,
                campaignTitle: campaignData.title,
                campaignSlug: campaignData.slug,
                amountFormatted: formatCents(amountCents),
                donationId: event.id,
              });
            }
          } catch { /* silent */ }
        })();
      }
    } else if (meta.plan && meta.userId) {
      // ── Platform subscription (SaaS plan) ─────────────────────────────────
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

  // ── Recurring donation — subsequent billing ───────────────────────────────
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
    if (!subscriptionId) return NextResponse.json({ ok: true });

    // Only handle campaign recurring donations (not platform subscriptions)
    const sub = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
    if (!sub) return NextResponse.json({ ok: true });

    const subMeta = sub.metadata as Record<string, string>;
    if (!subMeta.campaignId || !subMeta.isRecurring) return NextResponse.json({ ok: true });

    // Skip the first invoice — handled by checkout.session.completed above
    if (invoice.billing_reason === 'subscription_create') return NextResponse.json({ ok: true });

    const amountCents = invoice.amount_paid ?? 0;
    if (amountCents <= 0) return NextResponse.json({ ok: true });

    // Record subsequent recurring donation
    try {
      await supabaseAdmin.rpc('record_donation', {
        p_stripe_event_id: event.id,
        p_campaign_id: subMeta.campaignId,
        p_donor_id: subMeta.donorId || null,
        p_amount_cents: amountCents,
        p_tip_cents: 0,
        p_processing_fee_cents: 0,
        p_message: null,
        p_anonymous: subMeta.anonymous === '1',
        p_stripe_payment_intent_id: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : null,
        p_stripe_checkout_session_id: null,
      });
    } catch { /* non-fatal */ }

    // Update next_bill_at
    if (sub.current_period_end) {
      try {
        await supabaseAdmin
          .from('recurring_donations')
          .update({ next_bill_at: new Date(sub.current_period_end * 1000).toISOString() })
          .eq('stripe_subscription_id', subscriptionId);
      } catch { /* non-fatal */ }
    }
  }

  // ── Recurring donation — payment failed ───────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
    if (subscriptionId) {
      try {
        await supabaseAdmin
          .from('recurring_donations')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId);
      } catch { /* non-fatal */ }
    }
  }

  // ── Platform subscription: updated ───────────────────────────────────────
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.userId;
    if (userId && sub.metadata?.plan) {
      const planName = sub.metadata.plan;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      await supabaseAdmin
        .from('profiles')
        .update({ plan: isActive ? planName : 'free' })
        .eq('id', userId);
    }
  }

  // ── Platform subscription: deleted ───────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.userId;
    const customerId = typeof sub.customer === 'string' ? sub.customer : null;

    if (userId && sub.metadata?.plan) {
      // Platform subscription cancelled
      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('id', userId);
    } else {
      // Campaign recurring subscription cancelled
      try {
        await supabaseAdmin
          .from('recurring_donations')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id);
      } catch { /* non-fatal */ }

      // Fallback: downgrade plan if customer matches
      if (customerId && !userId) {
        await supabaseAdmin
          .from('profiles')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId);
      }
    }
  }

  // ── Stripe Connect account verified ──────────────────────────────────────
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
