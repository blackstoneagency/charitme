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

  // Idempotency: log every event; skip if already processed
  const { data: existing } = await supabaseAdmin
    .from('webhook_events')
    .select('id, processed_at')
    .eq('stripe_event_id', event.id)
    .maybeSingle();

  if (existing?.processed_at) {
    return NextResponse.json({ ok: true, status: 'already_processed' });
  }

  // Insert or update the event log row
  await supabaseAdmin.from('webhook_events').upsert(
    { stripe_event_id: event.id, event_type: event.type, payload: event as unknown as Record<string, unknown> },
    { onConflict: 'stripe_event_id', ignoreDuplicates: false },
  );

  try {
    await handleEvent(event);

    // Mark processed
    await supabaseAdmin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from('webhook_events')
      .update({ processing_error: msg })
      .eq('stripe_event_id', event.id);
    console.error('[webhook] unhandled error', event.type, msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main event dispatcher
// ─────────────────────────────────────────────────────────────────────────────
async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    // ── Checkout ─────────────────────────────────────────────────────────────
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.id, event.data.object as Stripe.Checkout.Session);
      break;

    // ── Recurring / invoice ───────────────────────────────────────────────────
    case 'invoice.payment_succeeded':
      await handleInvoiceSucceeded(event.id, event.data.object as Stripe.Invoice);
      break;
    case 'invoice.payment_failed':
      await handleInvoiceFailed(event.data.object as Stripe.Invoice);
      break;

    // ── Payment intents ───────────────────────────────────────────────────────
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    // ── Charges ───────────────────────────────────────────────────────────────
    case 'charge.succeeded':
      // No-op — payment_intent.succeeded is the canonical event
      break;
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;

    // ── Disputes / chargebacks ────────────────────────────────────────────────
    case 'charge.dispute.created':
      await handleDisputeCreated(event.data.object as Stripe.Dispute);
      break;
    case 'charge.dispute.closed':
      await handleDisputeClosed(event.data.object as Stripe.Dispute);
      break;

    // ── Platform subscriptions ────────────────────────────────────────────────
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    // ── Connect account ───────────────────────────────────────────────────────
    case 'account.updated':
      await handleAccountUpdated(event.data.object as Stripe.Account);
      break;

    // ── Transfers ─────────────────────────────────────────────────────────────
    // Note: transfer.paid and transfer.failed are not in the Stripe SDK type union
    // but are valid Stripe events — handled via the default path with raw object
    case 'transfer.created':
      await handleTransferPaid(event.data.object as Stripe.Transfer);
      break;

    // ── Payouts (on connected accounts) ──────────────────────────────────────
    case 'payout.created':
    case 'payout.paid':
      await handlePayoutPaid(event.data.object as Stripe.Payout);
      break;
    case 'payout.failed':
      await handlePayoutFailed(event.data.object as Stripe.Payout);
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// checkout.session.completed
// ─────────────────────────────────────────────────────────────────────────────
async function handleCheckoutComplete(eventId: string, session: Stripe.Checkout.Session) {
  const meta = (session.metadata ?? {}) as Record<string, string>;

  if (meta.campaignId && meta.isRecurring === '1') {
    // ── First payment of a recurring donation ─────────────────────────────
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    const amountCents = Number(meta.donationAmountCents ?? 0);
    const tipCents = Number(meta.tipCents ?? 0);

    if (subscriptionId && amountCents > 0) {
      await supabaseAdmin.rpc('record_donation', {
        p_stripe_event_id: eventId,
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

      await supabaseAdmin.from('recurring_donations').upsert({
        donor_id: meta.donorId || null,
        campaign_id: meta.campaignId,
        amount_cents: amountCents,
        cadence: meta.cadence ?? 'monthly',
        status: 'active',
        stripe_subscription_id: subscriptionId,
        next_bill_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'stripe_subscription_id', ignoreDuplicates: false });

      await sendDonorReceipt(meta.donorId, meta.campaignId, `${formatCents(amountCents)}/month`);
    }
  } else if (meta.campaignId) {
    // ── One-time donation ─────────────────────────────────────────────────
    const amountCents = Number(meta.donationAmountCents ?? session.amount_total ?? 0);
    const tipCents = Number(meta.tipCents ?? 0);
    const processingFeeCents = Number(meta.processingFeeCents ?? 0);
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    const { data, error } = await supabaseAdmin.rpc('record_donation', {
      p_stripe_event_id: eventId,
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

    if (error) throw new Error(`record_donation failed: ${error.message}`);

    const alreadyDone = (data as { status: string } | null)?.status === 'already_processed';
    if (!alreadyDone && meta.donorId && amountCents > 0) {
      await sendDonorReceipt(meta.donorId, meta.campaignId, formatCents(amountCents), eventId);
    }
  } else if (meta.plan && meta.userId) {
    // ── Platform SaaS subscription ────────────────────────────────────────
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    await supabaseAdmin.from('profiles').update({
      plan: meta.plan,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
    }).eq('id', meta.userId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// invoice.payment_succeeded  — subsequent recurring billing
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoiceSucceeded(eventId: string, invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (!subscriptionId) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
  if (!sub) return;

  const subMeta = sub.metadata as Record<string, string>;
  if (!subMeta.campaignId || !subMeta.isRecurring) return;

  // First invoice handled by checkout.session.completed
  if (invoice.billing_reason === 'subscription_create') return;

  const amountCents = invoice.amount_paid ?? 0;
  if (amountCents <= 0) return;

  await supabaseAdmin.rpc('record_donation', {
    p_stripe_event_id: eventId,
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

  if (sub.current_period_end) {
    await supabaseAdmin.from('recurring_donations').update({
      next_bill_at: new Date(sub.current_period_end * 1000).toISOString(),
    }).eq('stripe_subscription_id', subscriptionId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// invoice.payment_failed
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (!subscriptionId) return;
  await supabaseAdmin.from('recurring_donations').update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// payment_intent.succeeded — update donation status if missed by checkout
// ─────────────────────────────────────────────────────────────────────────────
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  await supabaseAdmin.from('donations')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', pi.id)
    .eq('status', 'pending');
}

// ─────────────────────────────────────────────────────────────────────────────
// payment_intent.payment_failed
// ─────────────────────────────────────────────────────────────────────────────
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  await supabaseAdmin.from('donations')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', pi.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// charge.refunded
// ─────────────────────────────────────────────────────────────────────────────
async function handleChargeRefunded(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  if (!piId) return;

  const isFullRefund = charge.refunded;
  const newStatus = isFullRefund ? 'refunded' : 'completed'; // partial keeps completed

  // Update donation status
  const { data: donation } = await supabaseAdmin.from('donations')
    .select('id, amount_cents, campaign_id')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle();

  if (!donation) return;

  await supabaseAdmin.from('donations').update({
    status: newStatus,
    refunded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', donation.id);

  if (isFullRefund) {
    try {
      await supabaseAdmin.rpc('decrement_campaign_stats', {
        p_campaign_id: donation.campaign_id,
        p_amount_cents: donation.amount_cents,
      });
    } catch { /* non-fatal */ }
  }

  // Update any matching refund record
  await supabaseAdmin.from('refunds')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('donation_id', donation.id)
    .in('status', ['requested', 'approved']);
}

// ─────────────────────────────────────────────────────────────────────────────
// charge.dispute.created
// ─────────────────────────────────────────────────────────────────────────────
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const piId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null;
  if (!piId) return;

  await supabaseAdmin.from('donations')
    .update({ status: 'disputed', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', piId);

  // Insert a refund record representing the chargeback
  const { data: donation } = await supabaseAdmin.from('donations')
    .select('id')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle();

  if (donation) {
    await supabaseAdmin.from('refunds').insert({
      donation_id: donation.id,
      amount_cents: dispute.amount,
      reason: `Stripe dispute: ${dispute.reason}`,
      notes: `Dispute ID: ${dispute.id}. Status: ${dispute.status}.`,
      status: 'requested',
      stripe_refund_id: dispute.id,
    });
  }

  // Write audit log
  await supabaseAdmin.from('audit_logs').insert({
    action: 'dispute.created',
    target_type: 'donation',
    target_id: donation?.id ?? null,
    metadata: { dispute_id: dispute.id, reason: dispute.reason, amount: dispute.amount },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// charge.dispute.closed
// ─────────────────────────────────────────────────────────────────────────────
async function handleDisputeClosed(dispute: Stripe.Dispute) {
  const piId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null;
  if (!piId) return;

  const won = dispute.status === 'won';

  await supabaseAdmin.from('donations')
    .update({
      status: won ? 'completed' : 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', piId)
    .eq('status', 'disputed');

  await supabaseAdmin.from('refunds')
    .update({ status: won ? 'declined' : 'processed', processed_at: new Date().toISOString() })
    .eq('stripe_refund_id', dispute.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// customer.subscription.updated
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (userId && sub.metadata?.plan) {
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    await supabaseAdmin.from('profiles').update({ plan: isActive ? sub.metadata.plan : 'free' }).eq('id', userId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// customer.subscription.deleted
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const customerId = typeof sub.customer === 'string' ? sub.customer : null;

  if (userId && sub.metadata?.plan) {
    await supabaseAdmin.from('profiles').update({ plan: 'free', stripe_subscription_id: null }).eq('id', userId);
  } else {
    await supabaseAdmin.from('recurring_donations').update({ status: 'cancelled' })
      .eq('stripe_subscription_id', sub.id);

    if (customerId && !userId) {
      await supabaseAdmin.from('profiles').update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_customer_id', customerId);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// account.updated — Stripe Connect
// ─────────────────────────────────────────────────────────────────────────────
async function handleAccountUpdated(account: Stripe.Account) {
  await supabaseAdmin.from('connected_accounts').update({
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    verification_status: account.details_submitted ? 'verified' : 'pending',
    updated_at: new Date().toISOString(),
  }).eq('stripe_account_id', account.id);

  if (account.details_submitted) {
    const { data: row } = await supabaseAdmin.from('connected_accounts')
      .select('user_id').eq('stripe_account_id', account.id).single();
    if (row?.user_id) {
      await supabaseAdmin.from('profiles').update({ identity_verified: true }).eq('id', row.user_id);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// transfer.created / transfer.paid
// ─────────────────────────────────────────────────────────────────────────────
async function handleTransferPaid(transfer: Stripe.Transfer) {
  // Update any payout record that references this transfer
  await supabaseAdmin.from('payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('stripe_payout_id', transfer.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// transfer.failed
// ─────────────────────────────────────────────────────────────────────────────
async function _handleTransferFailed(transfer: Stripe.Transfer) {
  await supabaseAdmin.from('payouts')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payout_id', transfer.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// payout.created / payout.paid (on connected accounts)
// ─────────────────────────────────────────────────────────────────────────────
async function handlePayoutPaid(payout: Stripe.Payout) {
  await supabaseAdmin.from('payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payout_id: payout.id, updated_at: new Date().toISOString() })
    .eq('stripe_payout_id', payout.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// payout.failed
// ─────────────────────────────────────────────────────────────────────────────
async function handlePayoutFailed(payout: Stripe.Payout) {
  await supabaseAdmin.from('payouts')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payout_id', payout.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function sendDonorReceipt(
  donorId: string | null | undefined,
  campaignId: string,
  amountFormatted: string,
  donationId?: string,
) {
  if (!donorId) return;
  try {
    const [{ data: profile }, { data: camp }] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, email').eq('id', donorId).single(),
      supabaseAdmin.from('campaigns').select('title, slug').eq('id', campaignId).single(),
    ]);
    if (profile?.email && camp) {
      await sendReceiptEmail({
        to: profile.email,
        donorName: profile.full_name,
        campaignTitle: camp.title,
        campaignSlug: camp.slug,
        amountFormatted,
        donationId,
      });
    }
  } catch {
    // Non-fatal — receipt failure must not fail webhook
  }
}
