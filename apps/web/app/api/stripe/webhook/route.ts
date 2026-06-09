import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe, formatCents } from '../../../../lib/stripe';
import { supabaseAdmin } from '../../../../lib/supabase';
import { sendReceiptEmail, sendOrganizerDonationAlert, sendPayoutEmail, sendRefundEmail } from '../../../../lib/email';
import { recordCampaignPayment, recordPaymentEvent } from '../../../../lib/payment-flow';

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
  await recordCampaignPaymentWebhookEvent(event, existing?.processed_at ? 'duplicate' : 'received');

  try {
    await handleEvent(event);

    // Mark processed
    await supabaseAdmin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);
    await supabaseAdmin
      .from('campaign_payment_webhook_events')
      .update({ status: 'processed', updated_at: new Date().toISOString() })
      .eq('processor_event_id', event.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from('webhook_events')
      .update({ processing_error: msg })
      .eq('stripe_event_id', event.id);
    await supabaseAdmin
      .from('campaign_payment_webhook_events')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('processor_event_id', event.id);
    console.error('[webhook] unhandled error', event.type, msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main event dispatcher
// ─────────────────────────────────────────────────────────────────────────────
async function handleEvent(event: Stripe.Event) {
  if ((event.type as string) === 'transfer.failed') {
    await handleTransferFailed(event.data.object as Stripe.Transfer);
    return;
  }

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
    case 'charge.updated':
      await handleChargeObserved(event.data.object as Stripe.Charge);
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
    case 'transfer.created':
      await handleTransferPaid(event.data.object as Stripe.Transfer);
      break;
    case 'application_fee.created':
      await handleApplicationFeeCreated(event.data.object as Stripe.ApplicationFee);
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
    const amountCents        = Number(meta.donationAmountCents ?? session.amount_total ?? 0);
    const tipCents           = Number(meta.tipCents ?? 0);
    const processingFeeCents = Number(meta.processingFeeCents ?? 0);
    const platformFeeCents   = Number(meta.platformFeeCents ?? tipCents);
    const paymentMethod      = meta.paymentMethod ?? 'stripe';
    const hasConnected       = meta.hasConnectedAccount === '1';
    const connectedAccountId = meta.connectedAccountId ?? '';
    const organizerUserId    = meta.organizerUserId ?? '';
    const paymentIntentId    = typeof session.payment_intent === 'string' ? session.payment_intent : null;
    const currency           = (session.currency ?? 'usd').toLowerCase();

    const { data, error } = await supabaseAdmin.rpc('record_donation', {
      p_stripe_event_id:           eventId,
      p_campaign_id:               meta.campaignId,
      p_donor_id:                  meta.donorId || null,
      p_amount_cents:              amountCents,
      p_tip_cents:                 tipCents,
      p_processing_fee_cents:      processingFeeCents,
      p_message:                   meta.message || null,
      p_anonymous:                 meta.anonymous === '1',
      p_stripe_payment_intent_id:  paymentIntentId,
      p_stripe_checkout_session_id: session.id,
    });

    if (error) throw new Error(`record_donation failed: ${error.message}`);

    const alreadyDone = (data as { status: string } | null)?.status === 'already_processed';
    const donationId = await findDonationId({ paymentIntentId, checkoutSessionId: session.id });

    // Store UTM attribution on the donation record (non-fatal)
    if (!alreadyDone && donationId) {
      const hasUtm = meta.utmSource || meta.utmMedium || meta.utmCampaign || meta.utmContent || meta.shareEventId;
      if (hasUtm) {
        const sourceUtm = {
          ...(meta.utmSource   ? { utm_source:   meta.utmSource }   : {}),
          ...(meta.utmMedium   ? { utm_medium:   meta.utmMedium }   : {}),
          ...(meta.utmCampaign ? { utm_campaign: meta.utmCampaign } : {}),
          ...(meta.utmContent  ? { utm_content:  meta.utmContent }  : {}),
          ...(meta.shareEventId ? { share_event_id: meta.shareEventId } : {}),
        };
        void Promise.resolve(
          supabaseAdmin.from('donations').update({ source_utm: sourceUtm }).eq('id', donationId),
        ).then(() => {
          if (meta.shareEventId) {
            void supabaseAdmin.from('share_events')
              .update({ converted: true, donation_id: donationId })
              .eq('id', meta.shareEventId);
          }
        });
      }
    }
    const campaignPaymentId = await recordCampaignPayment({
      donationId,
      campaignId: meta.campaignId,
      campaignOwnerId: organizerUserId || null,
      donorId: meta.donorId || null,
      processor: 'stripe',
      processorAccountId: connectedAccountId || null,
      processorPaymentIntentId: paymentIntentId,
      processorCheckoutSessionId: session.id,
      grossAmount: amountCents,
      tipAmount: tipCents,
      platformFeeAmount: platformFeeCents,
      processorFeeAmount: 0,
      ownerNetAmount: amountCents,
      currency,
      paymentStatus: 'succeeded',
      transferStatus: hasConnected ? 'created' : 'pending',
      payoutStatus: hasConnected ? 'requested' : 'not_applicable',
      paidAt: new Date().toISOString(),
      webhookEventId: eventId,
      metadata: {
        payment_method: paymentMethod,
        connected_account_id: connectedAccountId || null,
        donor_covered_processing_fee_cents: processingFeeCents,
        stripe_amount_total: session.amount_total ?? null,
      },
    });

    if (!alreadyDone && amountCents > 0 && organizerUserId) {
      const payoutStatus = hasConnected ? 'requested' : 'requested';
      const feeTotal = tipCents + processingFeeCents;

      const { data: payoutRow } = await supabaseAdmin.from('payouts').insert({
        campaign_id:     meta.campaignId,
        user_id:         organizerUserId,
        amount_cents:    amountCents,
        fee_cents:       feeTotal,
        payout_speed:    'standard',
        status:          payoutStatus,
        stripe_payout_id: connectedAccountId
          ? `auto_${paymentIntentId ?? session.id}`
          : null,
        note: hasConnected
          ? `Stripe Connect transfer requested (${paymentMethod}). Final bank payout remains pending processor confirmation. CharitMe tip: ${formatCents(platformFeeCents)}, donor-covered processing: ${formatCents(processingFeeCents)}.`
          : `Pending manual payout — organizer has no connected Stripe account. Donation via ${paymentMethod}.`,
      }).select('id').maybeSingle();

      if (campaignPaymentId) {
        await Promise.all([
          hasConnected
            ? supabaseAdmin.from('campaign_owner_transfers').insert({
                campaign_payment_id: campaignPaymentId,
                campaign_id: meta.campaignId,
                campaign_owner_id: organizerUserId,
                donor_id: meta.donorId || null,
                processor: 'stripe',
                processor_account_id: connectedAccountId || null,
                gross_amount: amountCents,
                owner_net_amount: amountCents,
                currency,
                status: 'created',
                metadata: { checkout_session_id: session.id, payment_intent_id: paymentIntentId },
              })
            : Promise.resolve(),
          supabaseAdmin.from('campaign_owner_payouts').insert({
            campaign_payment_id: campaignPaymentId,
            campaign_id: meta.campaignId,
            campaign_owner_id: organizerUserId,
            donor_id: meta.donorId || null,
            payout_id: payoutRow?.id ?? null,
            processor: 'stripe',
            processor_account_id: connectedAccountId || null,
            gross_amount: amountCents,
            owner_net_amount: amountCents,
            currency,
            status: hasConnected ? 'requested' : 'pending',
            metadata: { checkout_session_id: session.id, payment_intent_id: paymentIntentId },
          }),
          recordPaymentEvent({
            campaignPaymentId,
            campaignId: meta.campaignId,
            campaignOwnerId: organizerUserId,
            donorId: meta.donorId || null,
            processor: 'stripe',
            processorAccountId: connectedAccountId || null,
            processorObjectId: session.id,
            eventType: 'checkout.session.completed',
            eventStatus: 'processed',
            amount: amountCents,
            currency,
            metadata: { payment_intent_id: paymentIntentId, donor_covered_processing_fee_cents: processingFeeCents },
          }),
        ]);
      }

      // ── Audit log — split payment event ────────────────────────────────
      await supabaseAdmin.from('audit_logs').insert({
        action:      'donation.split_payment',
        target_type: 'campaign',
        target_id:   meta.campaignId,
        metadata: {
          donation_amount_cents:  amountCents,
          charitme_tip_cents:     platformFeeCents,
          processing_fee_cents:   processingFeeCents,
          organizer_receives:     amountCents,
          payment_method:         paymentMethod,
          connected_account_id:   connectedAccountId || null,
          has_connected_account:  hasConnected,
          stripe_session_id:      session.id,
          stripe_payment_intent:  paymentIntentId,
        },
      });
    }

    if (!alreadyDone && meta.donorId && amountCents > 0) {
      await sendDonorReceipt(meta.donorId, meta.campaignId, formatCents(amountCents), eventId);
    }

    // ── Notify organizer of new donation (non-blocking) ────────────────────
    if (!alreadyDone && organizerUserId && amountCents > 0) {
      sendOrganizerDonationNotification(organizerUserId, meta.campaignId, amountCents, meta.donorId || null).catch(() => {});
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

  const payment = await findCampaignPayment({ paymentIntentId: pi.id });
  if (!payment) return;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      payment_status: 'succeeded',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: pi.id,
      eventType: 'payment_intent.succeeded',
      eventStatus: pi.status,
      amount: pi.amount_received,
      currency: pi.currency,
      metadata: { latest_charge: typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// payment_intent.payment_failed
// ─────────────────────────────────────────────────────────────────────────────
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  await supabaseAdmin.from('donations')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', pi.id);

  const payment = await findCampaignPayment({ paymentIntentId: pi.id });
  if (!payment) return;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      payment_status: 'failed',
      settlement_status: 'failed',
      reconciliation_status: 'failed',
      reconciliation_reason: 'payment_intent_failed',
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: pi.id,
      eventType: 'payment_intent.payment_failed',
      eventStatus: pi.status,
      amount: pi.amount,
      currency: pi.currency,
      metadata: { last_payment_error: pi.last_payment_error?.code ?? null },
    }),
  ]);
}

async function handleChargeObserved(charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
  const payment = await findCampaignPayment({ paymentIntentId: piId, chargeId: charge.id });
  if (!payment) return;

  const balanceTransactionId = typeof charge.balance_transaction === 'string' ? charge.balance_transaction : null;
  const balanceTransaction = balanceTransactionId
    ? await stripe.balanceTransactions.retrieve(balanceTransactionId).catch(() => null)
    : null;
  const processorFeeAmount = balanceTransaction?.fee ?? payment.processor_fee_amount;
  const availableOn = balanceTransaction?.available_on
    ? new Date(balanceTransaction.available_on * 1000).toISOString()
    : payment.available_on;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      processor_charge_id: charge.id,
      processor_fee_amount: processorFeeAmount,
      available_on: availableOn,
      settlement_status: availableOn ? 'available' : payment.settlement_status,
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    balanceTransaction
      ? supabaseAdmin.from('campaign_processor_fees').upsert({
          campaign_payment_id: payment.id,
          campaign_id: payment.campaign_id,
          campaign_owner_id: payment.campaign_owner_id,
          donor_id: payment.donor_id,
          processor: 'stripe',
          processor_account_id: payment.processor_account_id,
          processor_object_id: balanceTransaction.id,
          gross_amount: charge.amount,
          processor_fee_amount: processorFeeAmount,
          currency: balanceTransaction.currency,
          status: 'recorded',
          metadata: { charge_id: charge.id, net: balanceTransaction.net },
        }, { onConflict: 'processor,processor_object_id', ignoreDuplicates: false })
      : Promise.resolve(),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: charge.id,
      eventType: `charge.${charge.status}`,
      eventStatus: charge.status,
      amount: charge.amount,
      currency: charge.currency,
      metadata: { balance_transaction_id: balanceTransactionId, processor_fee_amount: processorFeeAmount },
    }),
  ]);
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
    .select('id, amount_cents, campaign_id, donor_id, campaigns:campaign_id(title, slug)')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle();

  if (!donation) return;

  type DonationWithCampaign = { id: string; amount_cents: number; campaign_id: string; donor_id: string | null; campaigns: { title: string; slug: string } | null };
  const don = donation as unknown as DonationWithCampaign;

  await supabaseAdmin.from('donations').update({
    status: newStatus,
    refunded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', don.id);

  if (isFullRefund) {
    try {
      await supabaseAdmin.rpc('decrement_campaign_stats', {
        p_campaign_id: don.campaign_id,
        p_amount_cents: don.amount_cents,
      });
    } catch { /* non-fatal */ }
  }

  // Update any matching refund record
  await supabaseAdmin.from('refunds')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('donation_id', don.id)
    .in('status', ['requested', 'approved']);

  // Notify donor of refund (non-blocking)
  if (don.donor_id && isFullRefund && don.campaigns) {
    sendDonorRefundNotification(don.donor_id, don.campaigns.title, don.amount_cents).catch(() => {});
  }

  const payment = await findCampaignPayment({ paymentIntentId: piId, chargeId: charge.id });
  if (!payment) return;

  const refundedAmount = charge.amount_refunded ?? 0;
  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
      refund_status: isFullRefund ? 'full' : 'partial',
      refunded_amount: refundedAmount,
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    supabaseAdmin.from('campaign_payment_refunds').upsert({
      campaign_payment_id: payment.id,
      campaign_id: payment.campaign_id,
      campaign_owner_id: payment.campaign_owner_id,
      donor_id: payment.donor_id,
      processor: 'stripe',
      processor_account_id: payment.processor_account_id,
      processor_object_id: charge.id,
      gross_amount: payment.gross_amount,
      refund_amount: refundedAmount,
      currency: charge.currency,
      status: 'processed',
      metadata: { payment_intent_id: piId, refund_type: isFullRefund ? 'full' : 'partial' },
    }, { onConflict: 'processor,processor_object_id', ignoreDuplicates: false }),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: charge.id,
      eventType: 'charge.refunded',
      eventStatus: isFullRefund ? 'full' : 'partial',
      amount: refundedAmount,
      currency: charge.currency,
      metadata: { payment_intent_id: piId },
    }),
  ]);
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

  const payment = await findCampaignPayment({ paymentIntentId: piId });
  if (!payment) return;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      payment_status: 'disputed',
      dispute_status: 'opened',
      disputed_amount: dispute.amount,
      reconciliation_status: 'needs_review',
      reconciliation_reason: 'dispute_opened',
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    supabaseAdmin.from('campaign_payment_disputes').upsert({
      campaign_payment_id: payment.id,
      campaign_id: payment.campaign_id,
      campaign_owner_id: payment.campaign_owner_id,
      donor_id: payment.donor_id,
      processor: 'stripe',
      processor_account_id: payment.processor_account_id,
      processor_object_id: dispute.id,
      gross_amount: payment.gross_amount,
      dispute_amount: dispute.amount,
      currency: dispute.currency,
      status: 'opened',
      metadata: { payment_intent_id: piId, charge_id: typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null, reason: dispute.reason, opened_at: new Date().toISOString() },
    }, { onConflict: 'processor,processor_object_id', ignoreDuplicates: false }),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: dispute.id,
      eventType: 'charge.dispute.created',
      eventStatus: dispute.status,
      amount: dispute.amount,
      currency: dispute.currency,
      metadata: { reason: dispute.reason },
    }),
  ]);
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

  const payment = await findCampaignPayment({ paymentIntentId: piId });
  if (!payment) return;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      dispute_status: won ? 'won' : 'lost',
      reconciliation_status: won ? 'pending_data' : 'needs_review',
      reconciliation_reason: won ? 'dispute_won' : 'dispute_lost',
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    supabaseAdmin.from('campaign_payment_disputes').update({
      status: won ? 'won' : 'lost',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('processor_object_id', dispute.id),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: dispute.id,
      eventType: 'charge.dispute.closed',
      eventStatus: dispute.status,
      amount: dispute.amount,
      currency: dispute.currency,
      metadata: { outcome: dispute.status },
    }),
  ]);
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
  const sourceChargeId = typeof transfer.source_transaction === 'string' ? transfer.source_transaction : null;
  const payment = await findCampaignPayment({ transferId: transfer.id, chargeId: sourceChargeId });
  if (!payment) return;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      processor_transfer_id: transfer.id,
      transfer_status: 'created',
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    supabaseAdmin.from('campaign_owner_transfers').upsert({
      campaign_payment_id: payment.id,
      campaign_id: payment.campaign_id,
      campaign_owner_id: payment.campaign_owner_id,
      donor_id: payment.donor_id,
      processor: 'stripe',
      processor_account_id: payment.processor_account_id,
      processor_object_id: transfer.id,
      gross_amount: payment.gross_amount,
      owner_net_amount: transfer.amount,
      currency: transfer.currency,
      status: 'created',
      metadata: { destination: typeof transfer.destination === 'string' ? transfer.destination : transfer.destination?.id ?? null, source_charge_id: sourceChargeId },
    }, { onConflict: 'processor,processor_object_id', ignoreDuplicates: false }),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: transfer.id,
      eventType: 'transfer.created',
      eventStatus: 'created',
      amount: transfer.amount,
      currency: transfer.currency,
      metadata: { destination: typeof transfer.destination === 'string' ? transfer.destination : transfer.destination?.id ?? null, source_charge_id: sourceChargeId },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// transfer.failed
// ─────────────────────────────────────────────────────────────────────────────
async function handleTransferFailed(transfer: Stripe.Transfer) {
  await supabaseAdmin.from('payouts')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payout_id', transfer.id);

  const sourceChargeId = typeof transfer.source_transaction === 'string' ? transfer.source_transaction : null;
  const payment = await findCampaignPayment({ transferId: transfer.id, chargeId: sourceChargeId });
  if (!payment) return;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      transfer_status: 'failed',
      settlement_status: 'failed',
      reconciliation_status: 'failed',
      reconciliation_reason: 'transfer_failed',
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    supabaseAdmin.from('campaign_owner_transfers').update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    }).eq('processor_object_id', transfer.id),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: transfer.id,
      eventType: 'transfer.failed',
      eventStatus: 'failed',
      amount: transfer.amount,
      currency: transfer.currency,
      metadata: { destination: typeof transfer.destination === 'string' ? transfer.destination : transfer.destination?.id ?? null, source_charge_id: sourceChargeId },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// payout.created / payout.paid (on connected accounts)
// ─────────────────────────────────────────────────────────────────────────────
async function handleApplicationFeeCreated(fee: Stripe.ApplicationFee) {
  const chargeId = typeof fee.charge === 'string' ? fee.charge : null;
  const payment = await findCampaignPayment({ chargeId });
  if (!payment) return;

  await Promise.all([
    supabaseAdmin.from('campaign_payments').update({
      platform_fee_amount: fee.amount,
      updated_at: new Date().toISOString(),
    }).eq('id', payment.id),
    supabaseAdmin.from('campaign_platform_fees').insert({
      campaign_payment_id: payment.id,
      campaign_id: payment.campaign_id,
      campaign_owner_id: payment.campaign_owner_id,
      donor_id: payment.donor_id,
      processor: 'stripe',
      processor_account_id: payment.processor_account_id,
      processor_object_id: fee.id,
      gross_amount: payment.gross_amount,
      platform_fee_amount: fee.amount,
      currency: fee.currency,
      status: 'recorded',
      metadata: { charge_id: chargeId, balance_transaction_id: typeof fee.balance_transaction === 'string' ? fee.balance_transaction : null },
    }),
    recordPaymentEvent({
      campaignPaymentId: payment.id,
      campaignId: payment.campaign_id,
      campaignOwnerId: payment.campaign_owner_id,
      donorId: payment.donor_id,
      processor: 'stripe',
      processorAccountId: payment.processor_account_id,
      processorObjectId: fee.id,
      eventType: 'application_fee.created',
      eventStatus: 'recorded',
      amount: fee.amount,
      currency: fee.currency,
      metadata: { charge_id: chargeId },
    }),
  ]);
}

async function handlePayoutPaid(payout: Stripe.Payout) {
  await supabaseAdmin.from('payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payout_id: payout.id, updated_at: new Date().toISOString() })
    .eq('stripe_payout_id', payout.id);

  const payment = await findCampaignPayment({ payoutId: payout.id });
  if (payment) {
    await Promise.all([
      supabaseAdmin.from('campaign_payments').update({
        processor_payout_id: payout.id,
        payout_status: payout.status === 'paid' ? 'paid' : 'pending',
        settlement_status: payout.status === 'paid' ? 'paid_out' : 'pending',
        payout_at: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id),
      supabaseAdmin.from('campaign_owner_payouts').update({
        processor_object_id: payout.id,
        status: payout.status === 'paid' ? 'paid' : 'pending',
        updated_at: new Date().toISOString(),
      }).eq('campaign_payment_id', payment.id),
      recordPaymentEvent({
        campaignPaymentId: payment.id,
        campaignId: payment.campaign_id,
        campaignOwnerId: payment.campaign_owner_id,
        donorId: payment.donor_id,
        processor: 'stripe',
        processorAccountId: payment.processor_account_id,
        processorObjectId: payout.id,
        eventType: `payout.${payout.status}`,
        eventStatus: payout.status,
        amount: payout.amount,
        currency: payout.currency,
        metadata: { arrival_date: payout.arrival_date ?? null },
      }),
    ]);
    if (payout.status === 'paid') {
      notifyOrganizerPayout(payment.campaign_owner_id, payment.campaign_id, payout.amount, 'paid').catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// payout.failed
// ─────────────────────────────────────────────────────────────────────────────
async function handlePayoutFailed(payout: Stripe.Payout) {
  await supabaseAdmin.from('payouts')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payout_id', payout.id);

  const payment = await findCampaignPayment({ payoutId: payout.id });
  if (payment) {
    await Promise.all([
      supabaseAdmin.from('campaign_payments').update({
        payout_status: 'failed',
        settlement_status: 'failed',
        reconciliation_status: 'failed',
        reconciliation_reason: 'payout_failed',
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id),
      supabaseAdmin.from('campaign_owner_payouts').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      }).eq('campaign_payment_id', payment.id),
      recordPaymentEvent({
        campaignPaymentId: payment.id,
        campaignId: payment.campaign_id,
        campaignOwnerId: payment.campaign_owner_id,
        donorId: payment.donor_id,
        processor: 'stripe',
        processorAccountId: payment.processor_account_id,
        processorObjectId: payout.id,
        eventType: 'payout.failed',
        eventStatus: 'failed',
        amount: payout.amount,
        currency: payout.currency,
        metadata: { failure_code: payout.failure_code ?? null, failure_message: payout.failure_message ?? null },
      }),
    ]);
    notifyOrganizerPayout(payment.campaign_owner_id, payment.campaign_id, payout.amount, 'failed', payout.failure_code).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
type CampaignPaymentLookup = {
  id: string;
  campaign_id: string | null;
  campaign_owner_id: string | null;
  donor_id: string | null;
  processor_account_id: string | null;
  processor_fee_amount: number;
  gross_amount: number;
  available_on: string | null;
  settlement_status: string;
};

async function recordCampaignPaymentWebhookEvent(event: Stripe.Event, status: 'received' | 'duplicate' | 'processed' | 'failed' | 'ignored'): Promise<void> {
  const object = event.data.object as { id?: string; amount?: number; currency?: string; metadata?: Record<string, string> };
  const metadata = object.metadata ?? {};
  const campaignPayment = await findCampaignPayment({
    paymentIntentId: metadata.payment_intent_id ?? (event.type.startsWith('payment_intent.') ? object.id ?? null : null),
    checkoutSessionId: event.type.startsWith('checkout.session.') ? object.id ?? null : null,
    chargeId: event.type.startsWith('charge.') ? object.id ?? null : null,
    transferId: event.type.startsWith('transfer.') ? object.id ?? null : null,
    payoutId: event.type.startsWith('payout.') ? object.id ?? null : null,
  });

  await supabaseAdmin.from('campaign_payment_webhook_events').upsert({
    campaign_payment_id: campaignPayment?.id ?? null,
    campaign_id: metadata.campaignId || campaignPayment?.campaign_id || null,
    campaign_owner_id: metadata.organizerUserId || campaignPayment?.campaign_owner_id || null,
    donor_id: metadata.donorId || campaignPayment?.donor_id || null,
    processor: 'stripe',
    processor_account_id: metadata.connectedAccountId || campaignPayment?.processor_account_id || null,
    processor_object_id: object.id ?? null,
    processor_event_id: event.id,
    event_type: event.type,
    gross_amount: object.amount ?? 0,
    currency: (object.currency ?? 'usd').toLowerCase(),
    status,
    payload: event as unknown as Record<string, unknown>,
  }, { onConflict: 'processor,processor_event_id', ignoreDuplicates: false });
}

async function findCampaignPayment({
  paymentIntentId,
  checkoutSessionId,
  chargeId,
  transferId,
  payoutId,
}: {
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  chargeId?: string | null;
  transferId?: string | null;
  payoutId?: string | null;
}): Promise<CampaignPaymentLookup | null> {
  const select = 'id,campaign_id,campaign_owner_id,donor_id,processor_account_id,processor_fee_amount,gross_amount,available_on,settlement_status';
  let query = supabaseAdmin.from('campaign_payments').select(select).limit(1);

  const clauses = [
    paymentIntentId ? `processor_payment_intent_id.eq.${paymentIntentId}` : null,
    checkoutSessionId ? `processor_checkout_session_id.eq.${checkoutSessionId}` : null,
    chargeId ? `processor_charge_id.eq.${chargeId}` : null,
    transferId ? `processor_transfer_id.eq.${transferId}` : null,
    payoutId ? `processor_payout_id.eq.${payoutId}` : null,
  ].filter((clause): clause is string => clause !== null);

  if (clauses.length === 0) {
    return null;
  }

  query = query.or(clauses.join(','));
  const { data } = await query.maybeSingle();
  return (data ?? null) as CampaignPaymentLookup | null;
}

async function findDonationId({
  paymentIntentId,
  checkoutSessionId,
}: {
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
}): Promise<string | null> {
  let query = supabaseAdmin
    .from('donations')
    .select('id')
    .limit(1);

  if (paymentIntentId) {
    query = query.eq('stripe_payment_intent_id', paymentIntentId);
  } else if (checkoutSessionId) {
    query = query.eq('stripe_checkout_session_id', checkoutSessionId);
  } else {
    return null;
  }

  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}

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

async function sendOrganizerDonationNotification(
  organizerUserId: string,
  campaignId: string,
  amountCents: number,
  donorId: string | null,
) {
  try {
    const [{ data: organizer }, { data: camp }, { data: donor }] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, email').eq('id', organizerUserId).single(),
      supabaseAdmin.from('campaigns').select('title, slug, raised_amount, goal_amount').eq('id', campaignId).single(),
      donorId ? supabaseAdmin.from('profiles').select('full_name').eq('id', donorId).single() : Promise.resolve({ data: null }),
    ]);

    if (!organizer?.email || !camp) return;

    const donorDisplayName = donor?.full_name || 'An anonymous donor';
    const { formatCents: fmt } = await import('../../../../lib/stripe');

    // Insert in-app notification
    await supabaseAdmin.from('notifications').insert({
      user_id: organizerUserId,
      kind: 'donation_received',
      title: `New donation: ${fmt(amountCents)}`,
      body: `${donorDisplayName} donated ${fmt(amountCents)} to "${camp.title}".`,
      link: `/dashboard/campaigns`,
      meta: { campaign_id: campaignId, amount_cents: amountCents, donor_id: donorId },
    });

    await sendOrganizerDonationAlert({
      to: organizer.email,
      organizerName: organizer.full_name,
      campaignTitle: camp.title,
      campaignSlug: camp.slug,
      amountFormatted: fmt(amountCents),
      donorDisplayName,
      totalRaisedFormatted: fmt(camp.raised_amount ?? 0),
      goalFormatted: fmt(camp.goal_amount ?? 0),
    });
  } catch {
    // Non-fatal
  }
}

// Wire payout notifications into existing handlers
async function notifyOrganizerPayout(
  organizerUserId: string | null | undefined,
  campaignId: string | null | undefined,
  amountCents: number,
  status: 'paid' | 'failed' | 'scheduled',
  failureCode?: string | null,
) {
  if (!organizerUserId) return;
  try {
    const [{ data: organizer }, { data: camp }] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, email').eq('id', organizerUserId).single(),
      campaignId
        ? supabaseAdmin.from('campaigns').select('title').eq('id', campaignId).single()
        : Promise.resolve({ data: null }),
    ]);
    if (!organizer?.email) return;

    const { formatCents: fmt } = await import('../../../../lib/stripe');

    await supabaseAdmin.from('notifications').insert({
      user_id: organizerUserId,
      kind: `payout_${status}`,
      title: `Payout ${status}: ${fmt(amountCents)}`,
      body: camp ? `Payout for "${camp.title}"` : undefined,
      link: '/dashboard/payouts',
      meta: { campaign_id: campaignId, amount_cents: amountCents, status },
    });

    await sendPayoutEmail({
      to: organizer.email,
      organizerName: organizer.full_name,
      campaignTitle: camp?.title ?? 'your campaign',
      amountFormatted: fmt(amountCents),
      status,
      failureReason: failureCode ? `Failure code: ${failureCode}` : undefined,
    });
  } catch {
    // Non-fatal
  }
}

async function sendDonorRefundNotification(
  donorId: string,
  campaignTitle: string,
  amountCents: number,
) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', donorId)
      .single();
    if (!profile?.email) return;

    const { formatCents: fmt } = await import('../../../../lib/stripe');
    const amountFormatted = fmt(amountCents);

    await supabaseAdmin.from('notifications').insert({
      user_id: donorId,
      kind: 'refund_processed',
      title: `Refund processed: ${amountFormatted}`,
      body: `Your donation to "${campaignTitle}" has been refunded.`,
      link: '/dashboard/donations',
      meta: { campaign_title: campaignTitle, amount_cents: amountCents },
    });

    await sendRefundEmail({
      to: profile.email,
      donorName: profile.full_name,
      campaignTitle,
      amountFormatted,
    });
  } catch {
    // Non-fatal
  }
}
