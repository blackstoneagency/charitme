import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe, formatCents } from '../../../../lib/stripe';
import { peerRpcArg } from '../../../../lib/peer-attribution';
import { allocateCentsProportionally, decodeSplit, lineSessionId } from '../../../../lib/portfolio-split';
import { supabaseAdmin } from '../../../../lib/supabase';
import { sendReceiptEmail, sendTaxReceiptEmail, sendOrganizerDonationAlert, sendPayoutEmail, sendRefundEmail } from '../../../../lib/email';
import { canIssueTaxReceipt } from '../../../../lib/tax';
import { recordCampaignPayment, recordPaymentEvent } from '../../../../lib/payment-flow';
import { resolvePayoutDestination } from '../../../../lib/payout-destination';
import { resolveContact, trackEvent, refreshContactScores } from '../../../../lib/marketing-engine';
import { postDonation, postRefund, postDisputeLoss, openReconciliationException } from '../../../../lib/ledger';
import { boundedQuery } from '../../../../lib/query-timeout';
import { resolveRecurringRenewalAmounts } from '../../../../lib/recurring-payment';
import { normalizeReceiptEmail } from '../../../../lib/tax-receipt-access';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') ?? '';

  // Verify against the platform secret and (if configured) the Connect secret.
  // Connect events (account.updated, payout.*, transfer.*) are delivered on a
  // separate webhook endpoint signed with STRIPE_CONNECT_WEBHOOK_SECRET; trying
  // both secrets lets this single route accept platform and Connect events
  // without weakening verification (an attacker still can't forge either).
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter((s): s is string => !!s);

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      // try the next configured secret
    }
  }
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: log every event; skip if already processed.
  //
  // ⚠️ This read dropped its `error`. A failed read produced `existing = null`,
  // which is indistinguishable from "never seen this event" — so the duplicate
  // check silently disabled itself and the event was processed again. The money
  // paths behind it are individually idempotent (`record_donation` on
  // `p_stripe_event_id`, ledger posts on `idempotency_key`, the membership
  // upsert on `stripe_subscription_id`), so this is defence in depth rather than
  // the last line — but a defence that turns itself off when unreadable is not a
  // defence. Emails are NOT idempotent, so a reprocess re-sends receipts.
  //
  // Throwing is the right answer here and is this repo's webhook contract:
  // Stripe retries with backoff, which is strictly safer than reprocessing.
  const { data: existing, error: existingError } = await boundedQuery(() =>
    supabaseAdmin
      .from('webhook_events')
      .select('id, processed_at')
      .eq('stripe_event_id', event.id)
      .maybeSingle(),
  );
  if (existingError) {
    // Returned rather than thrown: this sits BEFORE the try/catch that converts
    // handler throws into a 500, so a throw here would escape POST entirely.
    // The status code is the only thing Stripe reads, so it is set explicitly.
    // The reason is not echoed to Stripe — it is a database message.
    console.error('[stripe webhook] idempotency read failed:', existingError.message);
    return NextResponse.json({ error: 'Idempotency check unavailable' }, { status: 500 });
  }

  if (existing?.processed_at) {
    // ⚠️ `status: 'duplicate'` was UNREACHABLE. It was passed below as
    // `existing?.processed_at ? 'duplicate' : 'received'` — but that line runs
    // only after this early return, so the condition is always false there and
    // the ternary always chose 'received'. `campaign_payment_webhook_events`
    // could therefore never record a duplicate delivery, and anything counting
    // them read zero forever — zero being the reassuring answer.
    //
    // Recorded HERE, where a duplicate actually is one. The recorder upserts on
    // (processor, processor_event_id) independently of the webhook_events row,
    // so it is safe to call before that row is touched.
    await recordCampaignPaymentWebhookEvent(event, 'duplicate');
    return NextResponse.json({ ok: true, status: 'already_processed' });
  }

  // Insert or update the event log row
  await supabaseAdmin.from('webhook_events').upsert(
    { stripe_event_id: event.id, event_type: event.type, payload: event as unknown as Record<string, unknown> },
    { onConflict: 'stripe_event_id', ignoreDuplicates: false },
  );
  await recordCampaignPaymentWebhookEvent(event, 'received');

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
    case 'checkout.session.expired':
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
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
    default:
      // Stripe delivers whatever the Dashboard subscribes to, which changes
      // independently of this file — this project's endpoint went from 2 events
      // to 20 in one sitting. Without this branch an event with no case here is
      // dropped in TOTAL silence: no log, no error, no row, and a 200 back to
      // Stripe so it never retries and nothing appears in the delivery log as
      // failed. The consequence surfaces much later as a data inconsistency
      // (a cancelled subscription still entitled, a refund never recorded) with
      // nothing linking it back to the missed event.
      //
      // Logged, not thrown: an unhandled event is not an error to Stripe, and
      // throwing would turn every newly-subscribed event into a retry storm.
      console.warn('[webhook] no handler for event type — dropped', {
        type: event.type,
        id: event.id,
      });
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// checkout.session.completed
// ─────────────────────────────────────────────────────────────────────────────
async function handleCheckoutComplete(eventId: string, session: Stripe.Checkout.Session) {
  const meta = (session.metadata ?? {}) as Record<string, string>;

  if (meta.type === 'event_ticket' && meta.registrationId) {
    if (session.payment_status !== 'paid') {
      throw new Error('Event ticket checkout completed without a paid payment status.');
    }
    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
    if (!paymentIntentId) throw new Error('Paid event ticket checkout has no payment intent.');

    const { data, error } = await supabaseAdmin.rpc('confirm_event_ticket_registration', {
      p_registration_id: meta.registrationId,
      p_stripe_checkout_session_id: session.id,
      p_stripe_payment_intent_id: paymentIntentId,
    });
    if (error || data !== true) {
      throw new Error('Paid event ticket registration could not be confirmed.');
    }
    return;
  }

  // ── Creator membership ────────────────────────────────────────────────────
  //
  // Branches BEFORE the donation paths and returns. A membership session is
  // subscription-mode with no `campaignId`, so falling through would run the
  // donation handler against a campaign that does not exist.
  //
  // Without this the subscription would exist at Stripe, charging the member
  // every period, with NO row in `member_subscriptions` — so the paywall would
  // keep the posts locked for someone who is paying for them.
  if (meta.kind === 'membership' && meta.tierId && meta.memberId) {
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;

    // Idempotent on `stripe_subscription_id`, which is UNIQUE — a Stripe retry
    // must not create a second membership. `onConflict` updates rather than
    // erroring so the retry is a no-op instead of a 500 that retries forever.
    const { error } = await supabaseAdmin
      .from('member_subscriptions')
      .upsert(
        {
          tier_id: meta.tierId,
          member_id: meta.memberId,
          status: 'active',
          stripe_subscription_id: subscriptionId,
        },
        { onConflict: 'stripe_subscription_id' },
      );

    // Throw, like every other money-critical write here: the webhook 500s,
    // Stripe redelivers, and the upsert above makes the retry safe. Returning
    // would answer 200 and strand a paying member outside the paywall.
    if (error) throw new Error(`membership could not be recorded: ${error.message}`);
    return;
  }

  // ── Portfolio gift: one payment, several campaigns ────────────────────────
  //
  // Branches BEFORE every other path and returns, so a portfolio session can
  // never fall through into the single-campaign handler — which would read a
  // `campaignId` that portfolio sessions do not set and record the whole gift
  // against nothing.
  if (meta.portfolio === '1' && session.payment_status === 'paid') {
    await handlePortfolioComplete(eventId, session, meta);
    return;
  }

  // ── Featured-campaign placement purchase ──────────────────────────────────
  if (meta.type === 'feature_campaign' && meta.campaignId && session.payment_status === 'paid') {
    const { error } = await supabaseAdmin
      .from('campaigns')
      .update({ featured: true })
      .eq('id', meta.campaignId);
    if (error) console.error('[webhook] feature_campaign update failed:', error.message);
    return;
  }

  if (meta.campaignId && meta.isRecurring === '1') {
    // ── First payment of a recurring donation ─────────────────────────────
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    const amountCents = Number(meta.donationAmountCents ?? 0);
    const tipCents = Number(meta.tipCents ?? 0);

    if (subscriptionId && amountCents > 0) {
      // Money has been collected by Stripe. If recording it fails we must NOT
      // return 2xx: the one-time path above throws for exactly this reason, so
      // the webhook 500s and Stripe retries until the donation lands.
      // `record_donation` is idempotent on `p_stripe_event_id`, so a retry
      // cannot double-count. Discarding this result meant a failure here left a
      // charged recurring donor with no donation row, no receipt, and campaign
      // totals that never moved — permanently, since nothing retried.
      const { error: recurringDonationError } = await supabaseAdmin.rpc('record_donation', {
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
        // A recurring gift started from a supporter page is attributed like any
        // other. Only the FIRST charge passes through here; later renewals are
        // invoice events with their own metadata. Omitted when the migration has
        // not run — see the note on the one-time path above.
        ...(await peerRpcArg(meta.peerFundraiserId)),
      });
      if (recurringDonationError) throw new Error('Initial recurring donation could not be recorded.');

      const { error: recurringConfigError } = await supabaseAdmin.from('recurring_donations').upsert({
        donor_id: meta.donorId || null,
        campaign_id: meta.campaignId,
        amount_cents: amountCents,
        tip_cents: tipCents,
        anonymous: meta.anonymous === '1',
        cadence: meta.cadence ?? 'monthly',
        status: 'active',
        stripe_subscription_id: subscriptionId,
        next_bill_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'stripe_subscription_id', ignoreDuplicates: false });
      if (recurringConfigError) {
        throw new Error('Recurring donation configuration could not be stored.');
      }

      // Record charge currency (non-fatal; column defaults to 'usd')
      const recurringCurrency = (session.currency ?? 'usd').toLowerCase();

      const recurringDonationId = await findDonationId({
        paymentIntentId: null,
        checkoutSessionId: session.id,
      });
      await sendDonorReceipt(
        {
          donorId: meta.donorId,
          email: session.customer_details?.email ?? session.customer_email,
          name: session.customer_details?.name,
        },
        meta.campaignId,
        formatCents(amountCents, recurringCurrency),
        recurringDonationId ?? undefined,
        'recurring',
      );

      // "Subscribe to receive emails" checkbox — opt a logged-in donor into
      // marketing emails (notification_marketing defaults FALSE, so this is a real
      // opt-in). Only set on opt-in; never clobber to false here.
      if (meta.donorId && meta.subscribeToUpdates === '1') {
        void supabaseAdmin.from('profiles').update({ notification_marketing: true }).eq('id', meta.donorId);
      }

      if (recurringCurrency !== 'usd') {
        const currencyDonId = await findDonationId({ paymentIntentId: null, checkoutSessionId: session.id });
        // Non-blocking, but logged: `donations.currency` DEFAULTS TO 'usd', so a
        // dropped write silently records a non-USD gift as dollars.
        if (currencyDonId) void supabaseAdmin.from('donations').update({ currency: recurringCurrency }).eq('id', currencyDonId)
          .then(({ error }) => { if (error) console.error('[webhook] recurring currency not recorded — donation will read as usd', { currencyDonId, recurringCurrency, code: error.code }); });
      }

      // Store UTM attribution on recurring donation (same logic as one-time)
      if (meta.utmSource || meta.utmMedium || meta.utmCampaign || meta.utmContent || meta.shareEventId) {
        const donId = await findDonationId({ paymentIntentId: null, checkoutSessionId: session.id });
        if (donId) {
          const sourceUtm = {
            ...(meta.utmSource    ? { utm_source:     meta.utmSource }    : {}),
            ...(meta.utmMedium    ? { utm_medium:     meta.utmMedium }    : {}),
            ...(meta.utmCampaign  ? { utm_campaign:   meta.utmCampaign }  : {}),
            ...(meta.utmContent   ? { utm_content:    meta.utmContent }   : {}),
            ...(meta.shareEventId ? { share_event_id: meta.shareEventId } : {}),
          };
          void supabaseAdmin.from('donations').update({ source_utm: sourceUtm }).eq('id', donId);
          if (meta.shareEventId) {
            void supabaseAdmin.from('share_events')
              .update({ converted: true, donation_id: donId })
              .eq('id', meta.shareEventId);
          }
        }
      }

      // Payment observability — parity with one-time donations so recurring
      // payments are traceable in the admin payments dashboard. The processor fee
      // is enriched later by handleChargeObserved (charge.succeeded) once Stripe
      // reports the balance transaction. recordCampaignPayment is idempotent.
      const initialRecurringPaymentId = await recordCampaignPayment({
        donationId: recurringDonationId,
        campaignId: meta.campaignId,
        campaignOwnerId: meta.organizerUserId || null,
        donorId: meta.donorId || null,
        processor: 'stripe',
        processorAccountId: meta.connectedAccountId || null,
        processorPaymentIntentId: null,
        processorCheckoutSessionId: session.id,
        grossAmount: amountCents,
        tipAmount: tipCents,
        platformFeeAmount: tipCents,
        processorFeeAmount: 0,
        ownerNetAmount: amountCents,
        currency: recurringCurrency,
        paymentStatus: 'succeeded',
        transferStatus: meta.hasConnectedAccount === '1' ? 'created' : 'pending',
        payoutStatus: meta.hasConnectedAccount === '1' ? 'requested' : 'not_applicable',
        paidAt: new Date().toISOString(),
        webhookEventId: eventId,
        metadata: {
          recurring: true,
          cadence: meta.cadence ?? 'monthly',
          subscription_id: subscriptionId,
        },
      });
      if (!initialRecurringPaymentId) {
        throw new Error('Initial recurring payment reporting could not be recorded.');
      }
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
    // Funds recipient — the beneficiary when the campaign is on someone's behalf
    const payoutRecipientId  = meta.payoutRecipientId || organizerUserId;
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
      // Peer-to-peer attribution, SPREAD rather than set literally: the key is
      // omitted entirely on a deployment where the migration has not run, because
      // an unknown named argument makes PostgREST resolve no function at all and
      // would break every donation. See lib/peer-attribution.ts.
      //
      // `/api/donations` already verified this id belongs to the campaign before
      // writing it to metadata, and `record_donation` verifies it AGAIN before
      // inserting — metadata is client-influenced and that function runs
      // SECURITY DEFINER.
      ...(await peerRpcArg(meta.peerFundraiserId)),
    });

    if (error) throw new Error(`record_donation failed: ${error.message}`);

    const alreadyDone = (data as { status: string } | null)?.status === 'already_processed';

    // Immutable ledger: record the disclosed donation split (best-effort, never
    // blocks donation recording). Idempotent via the Stripe event id + unique
    // index, so duplicate webhook deliveries do not double-post. True fee/payout
    // reconciliation against Stripe balance transactions happens in the recon job.
    if (!alreadyDone) {
      try {
        // Resolve by payment_intent OR checkout session, so the ledger row still
        // links to the donation when session.payment_intent is null (otherwise
        // the nightly reconciliation would false-flag it as missing_ledger).
        const donationId = await findDonationId({ paymentIntentId, checkoutSessionId: session.id });
        await postDonation(
          { donationCents: amountCents, platformFeeCents: platformFeeCents, processorFeeCents: processingFeeCents },
          {
            idempotencyKey: eventId,
            currency,
            campaignId: meta.campaignId,
            donationId,
            recipientUserId: payoutRecipientId || null,
            connectedAccountId: connectedAccountId || null,
            stripePaymentIntentId: paymentIntentId,
            source: 'webhook:checkout.session.completed',
          },
        );
      } catch (e) {
        console.warn('[ledger] donation posting failed (non-blocking):', e);
      }
    }

    // Marketing capture: donation_completed event + score refresh (non-blocking)
    if (!alreadyDone) {
      try {
        const donorEmail = session.customer_details?.email ?? session.customer_email ?? null;
        if (donorEmail) {
          const subscribed = meta.subscribeToUpdates === '1';
          const contactId = await resolveContact({
            email: donorEmail,
            userId: meta.donorId || undefined,
            clientType: 'donor',
            utmSource: meta.utmSource || undefined,
            utmMedium: meta.utmMedium || undefined,
            utmCampaign: meta.utmCampaign || undefined,
            // Consent audit + re-activate an existing contact on explicit opt-in
            // (never downgrades here — see resolveContact).
            consentEmail: subscribed,
            consentSource: 'donation_checkout',
            ...(subscribed ? { marketingStatus: 'active' as const } : {}),
          });
          if (contactId) {
            await trackEvent({
              contactId,
              eventType: 'donation_completed',
              campaignId: meta.campaignId,
              amountCents,
              utmSource: meta.utmSource || undefined,
              utmMedium: meta.utmMedium || undefined,
              utmCampaign: meta.utmCampaign || undefined,
            });
            await refreshContactScores(contactId);
          }
        }
      } catch (e) {
        console.error('[webhook] marketing capture failed (non-fatal):', e);
      }
    }
    const donationId = await findDonationId({ paymentIntentId, checkoutSessionId: session.id });

    // "Subscribe to receive emails" checkbox — opt a logged-in donor into
    // marketing emails (notification_marketing defaults FALSE → a real opt-in).
    // Guests are handled via marketing_contacts consent/status in the capture
    // block above. Only set on opt-in; never clobber to false here.
    if (!alreadyDone && meta.donorId && meta.subscribeToUpdates === '1') {
      void supabaseAdmin.from('profiles').update({ notification_marketing: true }).eq('id', meta.donorId);
    }

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

    // Record claimed reward tier. Deliberately non-blocking — a reward-tracking
    // failure must never fail the webhook and lose the donation itself — but NOT
    // silent. These were bare `void`s, so a failure vanished entirely, and the
    // consequence is concrete: POST /api/donations gates new claims on
    // `claimed_count >= item_limit`, so a dropped increment lets a limited reward
    // be OVERSOLD, while an unset `reward_id` leaves the organizer not knowing what
    // to fulfil. Errors are now logged so the condition is at least discoverable,
    // matching how the refund path treats its own best-effort ledger write.
    if (!alreadyDone && donationId && meta.rewardId) {
      const rewardId = meta.rewardId;
      void supabaseAdmin.from('donations').update({ reward_id: rewardId }).eq('id', donationId)
        .then(({ error }) => {
          if (error) console.error('[webhook] reward_id not recorded', { donationId, rewardId, code: error.code, message: error.message });
        });
      void supabaseAdmin.rpc('claim_campaign_reward', { p_reward_id: rewardId })
        .then(({ error }) => {
          if (error) console.error('[webhook] claim_campaign_reward failed — claimed_count may undercount, risking oversale', { rewardId, code: error.code, message: error.message });
        });
    }

    // Record charge currency (non-fatal; column defaults to 'usd')
    if (!alreadyDone && donationId && currency !== 'usd') {
      // Same as above: the column defaults to 'usd', so losing this misstates the
      // amount rather than merely omitting it.
      void supabaseAdmin.from('donations').update({ currency }).eq('id', donationId)
        .then(({ error }) => { if (error) console.error('[webhook] charge currency not recorded — donation will read as usd', { donationId, currency, code: error.code }); });
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
        user_id:         payoutRecipientId,
        amount_cents:    amountCents,
        fee_cents:       feeTotal,
        payout_speed:    'standard',
        status:          payoutStatus,
        stripe_payout_id: connectedAccountId
          ? `auto_${paymentIntentId ?? session.id}`
          : null,
        note: hasConnected
          ? `Stripe Connect transfer requested (${paymentMethod}). Final bank payout remains pending processor confirmation. CharitMe tip: ${formatCents(platformFeeCents, currency)}, donor-covered processing: ${formatCents(processingFeeCents, currency)}.`
          : `Pending manual payout — recipient has no connected Stripe account. Donation via ${paymentMethod}.`,
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

    if (!alreadyDone && amountCents > 0) {
      // Only a persisted donation UUID can back an official tax receipt.
      const realDonationId = await findDonationId({ paymentIntentId, checkoutSessionId: session.id });
      await sendDonorReceipt(
        {
          donorId: meta.donorId,
          email: session.customer_details?.email ?? session.customer_email,
          name: session.customer_details?.name,
        },
        meta.campaignId,
        formatCents(amountCents, currency),
        realDonationId ?? undefined,
      );
    }

    // ── Notify organizer of new donation (non-blocking) ────────────────────
    if (!alreadyDone && organizerUserId && amountCents > 0) {
      sendOrganizerDonationNotification(organizerUserId, meta.campaignId, amountCents, meta.donorId || null, currency, meta.anonymous === '1').catch(() => {});
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

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.type !== 'event_ticket' || !meta.registrationId) return;

  const { error } = await supabaseAdmin.rpc('release_event_ticket_reservation', {
    p_registration_id: meta.registrationId,
    p_stripe_checkout_session_id: session.id,
  });
  if (error) throw new Error('Expired event ticket reservation could not be released.');
}

// ── Stripe API-shape compatibility helpers ────────────────────────────────────
// The Stripe SDK's TypeScript types follow its pinned API version (2026-06-24),
// but webhook *payloads* use the API version configured on the endpoint, which
// may still be an older shape. Read these fields defensively so the handlers
// work regardless of which shape Stripe sends.
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: unknown }).subscription; // pre-2025 shape
  if (typeof legacy === 'string') return legacy;
  const sd = (invoice as unknown as { parent?: { subscription_details?: { subscription?: unknown } } })
    .parent?.subscription_details?.subscription;                                 // 2025+ shape
  if (typeof sd === 'string') return sd;
  return (sd as { id?: string } | undefined)?.id ?? null;
}
function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { payment_intent?: unknown }).payment_intent;
  if (typeof legacy === 'string') return legacy;
  const pi = (invoice as unknown as { payments?: { data?: Array<{ payment?: { payment_intent?: unknown } }> } })
    .payments?.data?.[0]?.payment?.payment_intent;
  return typeof pi === 'string' ? pi : null;
}
function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const legacy = (sub as unknown as { current_period_end?: unknown }).current_period_end;
  if (typeof legacy === 'number') return legacy;
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  return item?.current_period_end ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// invoice.payment_succeeded  — subsequent recurring billing
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoiceSucceeded(eventId: string, invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
  if (!sub) return;

  const subMeta = sub.metadata as Record<string, string>;
  if (!subMeta.campaignId || !subMeta.isRecurring) return;

  // First invoice handled by checkout.session.completed
  if (invoice.billing_reason === 'subscription_create') return;

  const invoiceAmountPaid = invoice.amount_paid ?? 0;
  if (invoiceAmountPaid <= 0) return;

  // Same as the subscription-checkout path: the renewal has already been charged,
  // so a failed record must 500 and let Stripe retry rather than be swallowed.
  const { data: recurringDonation, error: recurringError } = await supabaseAdmin
    .from('recurring_donations')
    .select('amount_cents, tip_cents, anonymous')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (recurringError) {
    throw new Error('Recurring donation configuration could not be read.');
  }

  const { donationAmountCents, tipCents } = resolveRecurringRenewalAmounts({
    invoiceAmountPaid,
    metadataDonationAmount: subMeta.donationAmountCents,
    metadataTipAmount: subMeta.tipCents,
    storedDonationAmount: recurringDonation?.amount_cents,
    storedTipAmount: recurringDonation?.tip_cents,
  });
  const anonymous = subMeta.anonymous !== undefined
    ? subMeta.anonymous === '1'
    : recurringDonation?.anonymous === true;

  const { error: donationError } = await supabaseAdmin.rpc('record_donation', {
    p_stripe_event_id: eventId,
    p_campaign_id: subMeta.campaignId,
    p_donor_id: subMeta.donorId || null,
    p_amount_cents: donationAmountCents,
    p_tip_cents: tipCents,
    p_processing_fee_cents: 0,
    p_message: null,
    p_anonymous: anonymous,
    p_stripe_payment_intent_id: invoicePaymentIntentId(invoice),
    p_stripe_checkout_session_id: null,
  });
  if (donationError) throw new Error('Recurring donation renewal could not be recorded.');

  const renewalDonationId = await findDonationId({
    paymentIntentId: invoicePaymentIntentId(invoice),
    checkoutSessionId: null,
  });
  await sendDonorReceipt(
    {
      donorId: subMeta.donorId,
      email: subMeta.donorEmail || null,
    },
    subMeta.campaignId,
    formatCents(donationAmountCents, (invoice.currency ?? 'usd').toLowerCase()),
    renewalDonationId ?? undefined,
    'recurring',
  );

  const periodEnd = subscriptionPeriodEnd(sub);
  if (periodEnd) {
    await supabaseAdmin.from('recurring_donations').update({
      next_bill_at: new Date(periodEnd * 1000).toISOString(),
    }).eq('stripe_subscription_id', subscriptionId);
  }

  // Payment observability for the RENEWAL charge — parity with one-time + the
  // initial recurring charge, so recurring payments stay traceable in the admin
  // Payments dashboard for every period (PAY-007 follow-up). Keyed by the invoice's
  // payment_intent, so handleChargeObserved matches it and enriches the real Stripe
  // processor fee. recordCampaignPayment is idempotent; non-fatal.
  try {
    const piId = invoicePaymentIntentId(invoice);
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('user_id, beneficiary_profile_id')
      .eq('id', subMeta.campaignId)
      .maybeSingle();
    const destination = campaign
      ? await resolvePayoutDestination(campaign as { user_id: string; beneficiary_profile_id?: string | null })
      : null;
    const campaignPaymentId = await recordCampaignPayment({
      donationId: renewalDonationId,
      campaignId: subMeta.campaignId,
      campaignOwnerId: (campaign as { user_id?: string } | null)?.user_id ?? null,
      donorId: subMeta.donorId || null,
      processor: 'stripe',
      processorAccountId: destination?.stripeAccountId ?? null,
      processorPaymentIntentId: piId,
      processorCheckoutSessionId: null,
      grossAmount: donationAmountCents,
      tipAmount: tipCents,
      platformFeeAmount: tipCents,
      processorFeeAmount: 0,
      ownerNetAmount: donationAmountCents,
      currency: (invoice.currency ?? 'usd').toLowerCase(),
      paymentStatus: 'succeeded',
      transferStatus: destination ? 'created' : 'pending',
      payoutStatus: destination ? 'requested' : 'not_applicable',
      paidAt: new Date().toISOString(),
      webhookEventId: eventId,
      metadata: {
        recurring: true,
        renewal: true,
        subscription_id: subscriptionId,
        cadence: subMeta.cadence ?? 'monthly',
        stripe_invoice_amount_paid: invoiceAmountPaid,
      },
    });
    if (!campaignPaymentId) {
      throw new Error('Recurring renewal payment reporting could not be recorded.');
    }
  } catch {
    throw new Error('Recurring renewal payment reporting failed.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// invoice.payment_failed
// ─────────────────────────────────────────────────────────────────────────────
async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
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

  const { data: eventTicketRefunded, error: eventTicketRefundError } = await supabaseAdmin.rpc(
    'apply_event_ticket_refund',
    {
      p_stripe_payment_intent_id: piId,
      p_refunded_cents: charge.amount_refunded ?? 0,
    },
  );
  if (eventTicketRefundError) {
    throw new Error('Refunded event ticket could not be reconciled; letting Stripe retry.');
  }
  if (eventTicketRefunded === true) return;

  const isFullRefund = charge.refunded;
  const newStatus = isFullRefund ? 'refunded' : 'completed'; // partial keeps completed

  // Update donation status
  const { data: donation, error: donationError } = await supabaseAdmin.from('donations')
    .select('id, amount_cents, tip_cents, campaign_id, donor_id, campaigns:campaign_id(title, slug)')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle();

  // A failed READ is not "no such donation", and the difference is permanent.
  // Falling through to `return` answers 200 to Stripe — so there is NO RETRY —
  // while the money has already gone back to the donor. The donation would stay
  // `completed` and the campaign's raised_amount would keep counting a refunded
  // gift, with nothing left to reconcile against.
  //
  // Throw instead, which is this file's established contract everywhere else
  // (see the recurring handlers): the webhook 500s, Stripe redelivers, and the
  // handler is idempotent so the retry is safe.
  if (donationError) throw new Error('Refunded donation could not be read; letting Stripe retry.');

  // Genuinely no row is different and NOT an error: a refund for a payment we
  // never recorded has nothing to update.
  if (!donation) return;

  type DonationWithCampaign = { id: string; amount_cents: number; tip_cents: number; campaign_id: string; donor_id: string | null; campaigns: { title: string; slug: string } | null };
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

  // Immutable ledger: reverse the recipient payable on refund (best-effort,
  // never blocks refund processing). A FULL refund is unambiguous — reverse the
  // whole donation principal + platform fee, keyed idempotently by charge id.
  // A PARTIAL refund's split across principal vs. fees is ambiguous from the
  // charge alone, so we open a reconciliation exception for finance to reverse
  // by hand rather than guess and post a wrong entry.
  try {
    if (isFullRefund) {
      await postRefund(
        { refundDonationCents: don.amount_cents, refundPlatformFeeCents: don.tip_cents ?? 0 },
        {
          idempotencyKey: `${charge.id}:refund:full`,
          currency: charge.currency,
          campaignId: don.campaign_id,
          donationId: don.id,
          stripeChargeId: charge.id,
          stripePaymentIntentId: piId,
          source: 'webhook:charge.refunded',
        },
      );
    } else {
      await openReconciliationException({
        kind: 'amount_mismatch',
        description: `Partial refund of ${charge.amount_refunded ?? 0} needs a manual ledger reversal (split across principal/fees is ambiguous).`,
        campaignId: don.campaign_id,
        donationId: don.id,
        stripeRef: charge.id,
        expectedCents: charge.amount_refunded ?? 0,
        actualCents: 0,
      });
    }
  } catch (e) {
    console.warn('[ledger] refund reversal failed (non-blocking):', e);
  }

  // Update any matching refund record
  await supabaseAdmin.from('refunds')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('donation_id', don.id)
    .in('status', ['requested', 'approved']);

  // Notify donor of refund (non-blocking)
  if (don.donor_id && isFullRefund && don.campaigns) {
    sendDonorRefundNotification(don.donor_id, don.campaigns.title, don.amount_cents, charge.currency).catch(() => {});
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

  const { data: eventTicketDisputed, error: eventTicketDisputeError } = await supabaseAdmin.rpc(
    'apply_event_ticket_dispute',
    {
      p_stripe_payment_intent_id: piId,
      p_stripe_dispute_id: dispute.id,
      p_outcome: 'opened',
    },
  );
  if (eventTicketDisputeError) {
    throw new Error('Event ticket dispute could not be recorded; letting Stripe retry.');
  }
  if (eventTicketDisputed === true) return;

  await supabaseAdmin.from('donations')
    .update({ status: 'disputed', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', piId);

  // Insert a refund record representing the chargeback
  const { data: donation, error: donationError } = await supabaseAdmin.from('donations')
    .select('id')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle();

  // Same reasoning as the refund handler above: an unreadable row silently
  // skipped the chargeback record and still answered 200, so Stripe never
  // retried and the dispute existed at Stripe with no trace here. Throw and let
  // the redelivery land it.
  if (donationError) throw new Error('Disputed donation could not be read; letting Stripe retry.');

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

  const { data: eventTicketDisputed, error: eventTicketDisputeError } = await supabaseAdmin.rpc(
    'apply_event_ticket_dispute',
    {
      p_stripe_payment_intent_id: piId,
      p_stripe_dispute_id: dispute.id,
      p_outcome: won ? 'won' : 'lost',
    },
  );
  if (eventTicketDisputeError) {
    throw new Error('Event ticket dispute outcome could not be recorded; letting Stripe retry.');
  }
  if (eventTicketDisputed === true) return;

  await supabaseAdmin.from('donations')
    .update({
      status: won ? 'completed' : 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', piId)
    .eq('status', 'disputed');

  // Immutable ledger: a LOST dispute is a forced clawback — reverse the recipient
  // payable + platform fee into the disputes account (best-effort, idempotent by
  // dispute id). A WON dispute leaves the money in place, so no ledger change.
  if (!won) {
    try {
      const { data: don } = await supabaseAdmin.from('donations')
        .select('id, amount_cents, tip_cents, campaign_id')
        .eq('stripe_payment_intent_id', piId)
        .maybeSingle();
      if (don) {
        await postDisputeLoss(
          { refundDonationCents: don.amount_cents, refundPlatformFeeCents: don.tip_cents ?? 0 },
          {
            idempotencyKey: `${dispute.id}:dispute:lost`,
            currency: dispute.currency,
            campaignId: don.campaign_id,
            donationId: don.id,
            stripeRefundId: dispute.id,
            source: 'webhook:charge.dispute.closed',
          },
        );
      }
    } catch (e) {
      console.warn('[ledger] dispute-loss reversal failed (non-blocking):', e);
    }
  }

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
  // A membership's status is what the paywall reads, so it has to track Stripe:
  // a past_due card must stop granting access, and a recovered one must restore
  // it without anyone intervening.
  if (sub.metadata?.kind === 'membership') {
    const status =
      sub.status === 'active' || sub.status === 'trialing' ? 'active'
      : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due'
      : sub.status === 'paused' ? 'paused'
      : 'cancelled';
    const { error } = await supabaseAdmin
      .from('member_subscriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id);
    if (error) throw new Error(`membership status could not be updated: ${error.message}`);
    return;
  }

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
  if (sub.metadata?.kind === 'membership') {
    const { error } = await supabaseAdmin
      .from('member_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id);
    if (error) throw new Error(`membership cancellation could not be recorded: ${error.message}`);
    return;
  }

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
      notifyOrganizerPayout(payment.campaign_owner_id, payment.campaign_id, payout.amount, 'paid', undefined, payout.currency).catch(() => {});
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
    notifyOrganizerPayout(payment.campaign_owner_id, payment.campaign_id, payout.amount, 'failed', payout.failure_code, payout.currency).catch(() => {});
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
  recipient: {
    donorId?: string | null;
    email?: string | null;
    name?: string | null;
  },
  campaignId: string,
  amountFormatted: string,
  donationId?: string,
  receiptType: 'donation' | 'recurring' = 'donation',
): Promise<void> {
  if (!recipient.donorId && !recipient.email) return;
  try {
    let donorEmail = recipient.email ?? null;
    let donorName = recipient.name ?? null;
    if (recipient.donorId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, email')
        .eq('id', recipient.donorId)
        .single();
      donorEmail = profile?.email ?? donorEmail;
      donorName = profile?.full_name ?? donorName;
    }

    // ⚠️ This whole function is deliberately wrapped in `catch {}` below — a
    // receipt failure must NOT fail the webhook, because failing would make
    // Stripe re-run the donation handler. That is correct, and it means
    // "throw and let Stripe retry" is the wrong instinct here.
    //
    // What it does NOT justify is failing INVISIBLY. Each read below dropped its
    // `error`, so a transient failure silently changed what the donor received
    // with nothing recorded anywhere. Logging is the whole fix: the behaviour
    // stays non-fatal, but it stops being unobservable.
    const { data: camp, error: campError } = await supabaseAdmin
      .from('campaigns')
      .select('title, slug, user_id')
      .eq('id', campaignId)
      .single();
    if (campError) {
      // The donor gets NO receipt at all, and unlike deductibility below,
      // nothing else ever recovers this one.
      console.error('[receipt] campaign read failed, no receipt sent:', {
        campaignId, donationId, code: campError.code, message: campError.message,
      });
      return;
    }
    if (!donorEmail || !camp) return;

    const { data: donationRow } = donationId
      ? await supabaseAdmin
        .from('donations')
        .select('donor_id, amount_cents, tip_cents, processing_fee_cents, currency, created_at, stripe_payment_intent_id, stripe_checkout_session_id')
        .eq('id', donationId)
        .maybeSingle()
      : { data: null };
    if (donationId && !donationRow) return;

    const { data: existingReceipt } = donationId
      ? await supabaseAdmin
        .from('donation_receipts')
        .select('id, receipt_number')
        .eq('donation_id', donationId)
        .limit(1)
        .maybeSingle()
      : { data: null };

    // If the campaign is run by a verified nonprofit that issues tax receipts
    // (and has an EIN), the donor's automatic receipt should be the OFFICIAL
    // tax receipt — with EIN, receipt number, and the no-goods-or-services
    // disclosure — not the generic thank-you. This matches the deductibility
    // rule used by the annual giving statement (lib/tax.ts).
    type NpRow = { id: string; name: string; tax_id: string | null; verified: boolean; verification_status: string; tax_receipt_enabled: boolean };
    let nonprofit: NpRow | null = null;
    if (camp.user_id) {
      const { data: np, error: npError } = await supabaseAdmin
        .from('nonprofit_profiles')
        .select('id, name, tax_id, verified, verification_status, tax_receipt_enabled')
        .eq('owner_id', camp.user_id)
        .maybeSingle();
      if (npError) {
        // A failed read here made `deductible` false, so a donation to a
        // VERIFIED NONPROFIT silently received the generic thank-you instead of
        // an official tax receipt with EIN and disclosure — indistinguishable
        // from a genuinely non-deductible gift.
        //
        // Bounded, and worth stating precisely rather than overstating: the
        // annual giving statement (`lib/tax.ts`, reachable from /donor)
        // recomputes deductibility from `nonprofit_profiles` at generation time,
        // so the donor's year-end documentation still comes out right. What is
        // lost is the per-donation receipt, and — until now — any trace of it.
        console.error('[receipt] nonprofit read failed, sent as NON-deductible:', {
          campaignId, donationId, ownerId: camp.user_id, code: npError.code, message: npError.message,
        });
      }
      nonprofit = (np as NpRow | null) ?? null;
    }

    const deductible = Boolean(donationId) && nonprofit !== null && canIssueTaxReceipt({
      name: nonprofit.name,
      taxId: nonprofit.tax_id,
      verified: nonprofit.verified || nonprofit.verification_status === 'verified',
      taxReceiptEnabled: nonprofit.tax_receipt_enabled,
    });

    const taxEligible = Boolean(nonprofit)
      && (nonprofit!.verified || nonprofit!.verification_status === 'verified')
      && nonprofit!.tax_receipt_enabled;
    const receiptYear = donationRow?.created_at
      ? new Date(donationRow.created_at).getUTCFullYear()
      : new Date().getUTCFullYear();
    const receiptNumber = existingReceipt?.receipt_number
      ?? (donationId ? `RCP-${receiptYear}-${donationId.slice(0, 8).toUpperCase()}` : null);
    if (deductible && nonprofit && receiptNumber) {
      const taxDelivery = await sendTaxReceiptEmail({
        to: donorEmail,
        donorName,
        nonprofitName: nonprofit.name,
        nonprofitEin: nonprofit.tax_id!,
        campaignTitle: camp.title,
        amountFormatted,
        receiptNumber,
        donationDate: new Date(donationRow!.created_at).toLocaleDateString(
          'en-US',
          { month: 'long', day: 'numeric', year: 'numeric' },
        ),
      });
      if (!taxDelivery.sent) return;
      const { error: taxReceiptError } = await supabaseAdmin.from('tax_receipts').upsert({
        donation_id: donationId!,
        donor_id: donationRow!.donor_id ?? recipient.donorId ?? null,
        nonprofit_id: nonprofit.id,
        receipt_number: receiptNumber,
        amount_cents: donationRow!.amount_cents,
        currency: donationRow!.currency ?? 'usd',
        nonprofit_name: nonprofit.name,
        nonprofit_ein: nonprofit.tax_id,
        campaign_title: camp.title,
        emailed_at: new Date().toISOString(),
      }, { onConflict: 'donation_id' });
      if (taxReceiptError) {
        console.error('[webhook] tax receipt delivery could not be recorded', {
          donation_id: donationId,
          code: taxReceiptError.code,
        });
      }
    } else {
      const receiptDelivery = await sendReceiptEmail({
        to: donorEmail,
        donorName,
        campaignTitle: camp.title,
        campaignSlug: camp.slug,
        amountFormatted,
        donationId,
      });
      if (!receiptDelivery.sent) return;
    }

    if (!donationId || !donationRow || !receiptNumber) return;
    const deliveredAt = new Date().toISOString();
    const receiptValues = {
      donation_id: donationId,
      donor_id: donationRow.donor_id ?? recipient.donorId ?? null,
      campaign_id: campaignId,
      receipt_number: receiptNumber,
      amount_cents: donationRow.amount_cents,
      tip_cents: donationRow.tip_cents ?? 0,
      processing_fee_cents: donationRow.processing_fee_cents ?? 0,
      currency: donationRow.currency ?? 'usd',
      is_tax_deductible: taxEligible,
      nonprofit_ein: taxEligible ? nonprofit?.tax_id ?? null : null,
      campaign_title: camp.title,
      donor_name: donorName,
      donor_email: normalizeReceiptEmail(donorEmail),
      email_sent_at: deliveredAt,
      resent_at: existingReceipt ? deliveredAt : null,
      stripe_payment_intent_id: donationRow.stripe_payment_intent_id,
      stripe_checkout_session_id: donationRow.stripe_checkout_session_id,
      receipt_type: receiptType,
    };
    const { error: receiptLedgerError } = existingReceipt
      ? await supabaseAdmin
        .from('donation_receipts')
        .update(receiptValues)
        .eq('id', existingReceipt.id)
      : await supabaseAdmin.from('donation_receipts').insert(receiptValues);
    if (receiptLedgerError) {
      console.error('[webhook] receipt delivery could not be recorded', {
        donation_id: donationId,
        code: receiptLedgerError.code,
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
  currency: string = 'usd',
  /**
   * Whether the donor chose "donate anonymously" for THIS gift.
   *
   * Previously this function never received it, so the display name fell back to
   * "An anonymous donor" only when the profile had no full_name — meaning a donor
   * who ticked anonymous but had a name on file was announced BY NAME to the
   * organizer, in both the alert email and the in-app notification. That is the
   * one person anonymity is meant to hide the donor from.
   */
  isAnonymous: boolean = false,
) {
  try {
    const [{ data: organizer }, { data: camp }, { data: donor }] = await Promise.all([
      supabaseAdmin.from('profiles').select('full_name, email, notification_email').eq('id', organizerUserId).single(),
      supabaseAdmin.from('campaigns').select('title, slug, raised_amount, goal_amount').eq('id', campaignId).single(),
      donorId ? supabaseAdmin.from('profiles').select('full_name, show_public_profile').eq('id', donorId).single() : Promise.resolve({ data: null }),
    ]);

    if (!organizer?.email || !camp) return;

    // Both gates, matching the donor wall, leaderboard and exports: the per-gift
    // `anonymous` choice and the account-wide Profile Visibility setting.
    const donorIsPublic = donor?.show_public_profile ?? true;
    const donorDisplayName = (isAnonymous || !donorIsPublic)
      ? 'An anonymous donor'
      : (donor?.full_name || 'An anonymous donor');
    const { formatCents: fmt } = await import('../../../../lib/stripe');

    // Insert in-app notification
    await supabaseAdmin.from('notifications').insert({
      user_id: organizerUserId,
      kind: 'donation_received',
      title: `New donation: ${fmt(amountCents, currency)}`,
      body: `${donorDisplayName} donated ${fmt(amountCents, currency)} to "${camp.title}".`,
      link: `/dashboard/campaigns`,
      meta: { campaign_id: campaignId, amount_cents: amountCents, donor_id: donorId },
    });

    if (organizer.notification_email === false) return; // organizer opted out of account emails

    await sendOrganizerDonationAlert({
      to: organizer.email,
      organizerName: organizer.full_name,
      campaignTitle: camp.title,
      campaignSlug: camp.slug,
      amountFormatted: fmt(amountCents, currency),
      donorDisplayName,
      totalRaisedFormatted: fmt(camp.raised_amount ?? 0, currency),
      goalFormatted: fmt(camp.goal_amount ?? 0, currency),
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
  currency: string = 'usd',
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
      title: `Payout ${status}: ${fmt(amountCents, currency)}`,
      body: camp ? `Payout for "${camp.title}"` : undefined,
      link: '/dashboard/payouts',
      meta: { campaign_id: campaignId, amount_cents: amountCents, status },
    });

    await sendPayoutEmail({
      to: organizer.email,
      organizerName: organizer.full_name,
      campaignTitle: camp?.title ?? 'your campaign',
      amountFormatted: fmt(amountCents, currency),
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
  currency: string = 'usd',
) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', donorId)
      .single();
    if (!profile?.email) return;

    const { formatCents: fmt } = await import('../../../../lib/stripe');
    const amountFormatted = fmt(amountCents, currency);

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

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio gifts — record one donation per campaign, then fan the money out.
//
// The charge landed on the PLATFORM (no transfer_data), tagged with a
// transfer_group. Two things have to happen, in this order and with different
// failure semantics:
//
//   1. RECORD each line. Keyed `<session>#<campaignId>` because record_donation
//      is idempotent on the session id, so N lines sharing one session would
//      collapse into a single row. A failure here THROWS so Stripe retries —
//      the donor has paid and a missing donation row is unrecoverable silently.
//
//   2. TRANSFER to each connected account. A failure here is logged and NOT
//      thrown: the money is safely on the platform balance and a transfer can be
//      retried by an operator, whereas throwing would make Stripe redeliver the
//      whole event and re-run step 1 — which is idempotent, but would also retry
//      transfers that already succeeded. Recording is the part that must be
//      exactly-once; transferring is the part that must be re-runnable.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Record money CharitMe is HOLDING because a portfolio transfer did not happen.
 *
 * ⚠️ This is the difference between "we briefly held funds" and "we held funds
 * and nobody knows". The two failure paths below previously did
 * `console.warn` / `console.error` and `continue`, and the comment above them
 * claimed the organizer "gets paid when they do [onboard]" and that "a transfer
 * can be retried by an operator" — but nothing scheduled that payment and the
 * operator had only a log line, which rotates. Donor money could sit on the
 * platform balance indefinitely with no durable record of who it belonged to.
 *
 * `reconciliation_exceptions` is the existing, applied home for exactly this:
 * it is read by /api/admin/ledger and swept by the reconcile-ledger cron, so an
 * outstanding obligation becomes visible and actionable instead of invisible.
 *
 * Deliberately best-effort — a failure to RECORD the problem must not throw,
 * because throwing here would make Stripe redeliver the event and re-run
 * transfers that already succeeded. The log line is kept as well as the row.
 */
async function recordHeldFunds(params: {
  campaignId: string;
  amountCents: number;
  sessionId: string;
  reason: string;
}): Promise<void> {
  try {
    // ⚠️ Look for an OPEN exception for this (session, campaign) first.
    //
    // Stripe redelivers events, and an operator may retry a transfer that fails
    // again. A plain insert opens a second exception for the same debt every
    // time, so `/api/admin/ledger` reports two, three, four times the money as
    // outstanding. On the one surface whose entire job is to prove the books
    // balance, an inflated liability is worse than a missing one — it makes the
    // real figure unknowable.
    const { data: open } = await supabaseAdmin
      .from('reconciliation_exceptions')
      .select('id')
      .eq('stripe_ref', params.sessionId)
      .eq('campaign_id', params.campaignId)
      .eq('status', 'open')
      .maybeSingle();

    const description =
      `Portfolio transfer not completed for campaign ${params.campaignId}: ${params.reason}. `
      + `CharitMe is holding ${params.amountCents} cents owed to this campaign's recipient.`;

    if (open?.id) {
      // Same debt, newer reason. Update rather than duplicate.
      await supabaseAdmin
        .from('reconciliation_exceptions')
        .update({ description })
        .eq('id', open.id);
      return;
    }

    await supabaseAdmin.from('reconciliation_exceptions').insert({
      kind: 'payout_mismatch',
      description,
      campaign_id: params.campaignId,
      stripe_ref: params.sessionId,
      expected_cents: params.amountCents,
      actual_cents: 0,
      difference_cents: params.amountCents,
    });
  } catch (err) {
    console.error('[webhook] could not record held funds', {
      campaignId: params.campaignId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Close the held-funds exception once the money actually reaches the recipient.
 *
 * ⚠️ Without this the exception stays `open` forever. The debt is settled, the
 * organizer has been paid, and the reconciliation surface still reports the
 * money as outstanding — so the admin ledger drifts further from reality with
 * every recovered transfer, and the figure that is supposed to prove the books
 * balance becomes the reason nobody trusts them.
 *
 * Best-effort and never throws, for the same reason as `recordHeldFunds`: this
 * runs inside the webhook, and throwing would make Stripe redeliver and re-run
 * transfers that already succeeded.
 */
async function clearHeldFunds(params: {
  campaignId: string;
  sessionId: string;
  transferId: string;
}): Promise<void> {
  try {
    await supabaseAdmin
      .from('reconciliation_exceptions')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        // The actual figures now match, so the difference is zero. Leaving the
        // original difference on a resolved row would keep it counted by any
        // sum that filters on amount rather than status.
        actual_cents: null,
        difference_cents: 0,
        resolution_note: `Transfer ${params.transferId} completed.`,
      })
      .eq('stripe_ref', params.sessionId)
      .eq('campaign_id', params.campaignId)
      // ⚠️ Only OPEN rows. Without this a redelivered event overwrites the
      // original resolution timestamp, destroying the record of when the debt
      // was actually settled.
      .eq('status', 'open');
  } catch (err) {
    console.error('[webhook] could not clear held funds', {
      campaignId: params.campaignId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handlePortfolioComplete(
  eventId: string,
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
) {
  const parts = decodeSplit(meta.portfolioSplit);
  if (parts.length === 0) {
    console.error('[webhook] portfolio session had no decodable split', { session: session.id });
    return;
  }
  const tipParts = allocateCentsProportionally(Number(meta.tipCents ?? 0), parts);
  const processingParts = allocateCentsProportionally(Number(meta.processingFeeCents ?? 0), parts);

  for (const [index, part] of parts.entries()) {
    const { error } = await supabaseAdmin.rpc('record_donation', {
      p_stripe_event_id: `${eventId}#${part.campaignId}`,
      p_campaign_id: part.campaignId,
      p_donor_id: meta.donorId || null,
      p_amount_cents: part.amountCents,
      p_tip_cents: tipParts[index]?.amountCents ?? 0,
      p_processing_fee_cents: processingParts[index]?.amountCents ?? 0,
      p_message: meta.message || null,
      p_anonymous: meta.anonymous === '1',
      // NULL, deliberately. All lines share one payment intent, and
      // record_donation treats a matching intent as already-processed — passing
      // the real one would make every line after the first a no-op.
      p_stripe_payment_intent_id: null,
      p_stripe_checkout_session_id: lineSessionId(session.id, part.campaignId),
    });
    if (error) throw new Error(`portfolio line failed for ${part.campaignId}: ${error.message}`);
  }

  // Fan out. Resolved per campaign because the campaigns may belong to different
  // people with different connected accounts — the whole reason this path exists.
  for (const part of parts) {
    try {
      // resolvePayoutDestination takes the campaign ROW (it has to consult
      // beneficiary_profile_id), not an id.
      const { data: campaignRow } = await supabaseAdmin
        .from('campaigns')
        .select('user_id, beneficiary_profile_id')
        .eq('id', part.campaignId)
        .maybeSingle();
      if (!campaignRow) {
        console.error('[webhook] portfolio transfer: campaign vanished', { campaignId: part.campaignId });
        continue;
      }
      const destination = await resolvePayoutDestination(
        campaignRow as { user_id: string; beneficiary_profile_id?: string | null },
      );
      if (!destination?.stripeAccountId) {
        // Not an error: an organizer who has not finished Stripe onboarding gets
        // paid when they do. The donation row already exists and is correct.
        console.warn('[webhook] portfolio transfer deferred, no connected account', {
          campaignId: part.campaignId,
        });
        await recordHeldFunds({
          campaignId: part.campaignId,
          amountCents: part.amountCents,
          sessionId: session.id,
          reason: 'recipient has no verified connected account',
        });
        continue;
      }
      const transfer = await stripe.transfers.create(
        {
          amount: part.amountCents,
          currency: 'usd',
          destination: destination.stripeAccountId,
          transfer_group: `portfolio_${session.id}`,
          metadata: { campaignId: part.campaignId, checkoutSessionId: session.id },
        },
        // Idempotent per (session, campaign) so a redelivered event cannot pay
        // an organizer twice.
        { idempotencyKey: `portfolio_transfer_${session.id}_${part.campaignId}` },
      );
      // The money reached the recipient, so any held-funds exception for this
      // line is settled. A no-op on the common path, where none was ever opened.
      await clearHeldFunds({
        campaignId: part.campaignId,
        sessionId: session.id,
        transferId: transfer.id,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error('[webhook] portfolio transfer failed', { campaignId: part.campaignId, error: reason });
      await recordHeldFunds({
        campaignId: part.campaignId,
        amountCents: part.amountCents,
        sessionId: session.id,
        reason: `transfer failed (${reason})`,
      });
    }
  }
}
