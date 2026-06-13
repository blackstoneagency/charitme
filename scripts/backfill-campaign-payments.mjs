// One-time backfill: populate campaign_payments (+ related observability tables)
// from historical `donations` rows that predate the payment-observability schema
// (migration 20260608020000_campaign_payment_observability.sql). New donations are
// already recorded going forward via recordCampaignPayment() in the Stripe webhook —
// this script only fills in the gap for transactions that happened before that landed.
//
// Usage (from repo root):
//   node scripts/backfill-campaign-payments.mjs           # dry run, prints what would be inserted
//   node scripts/backfill-campaign-payments.mjs --apply   # actually writes rows
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const apply = process.argv.includes('--apply');

function loadEnvLocal() {
  const envPath = join(root, 'apps', 'web', '.env.local');
  const text = readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from apps/web/.env.local');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Mirrors PaymentStatus mapping used by the live webhook for `checkout.session.completed`.
function mapPaymentStatus(donationStatus) {
  switch (donationStatus) {
    case 'completed': return 'succeeded';
    case 'refunded': return 'refunded';
    case 'failed': return 'failed';
    case 'disputed': return 'disputed';
    default: return 'pending';
  }
}

// Port of reconcileMoneyFlow() from apps/web/lib/payment-flow.ts — kept in lockstep so
// backfilled rows land in the same reconciliation buckets as live-recorded ones.
function reconcile(flow) {
  const issues = [];
  const expectedOwnerNet = flow.grossAmount - flow.refundedAmount - flow.disputedAmount;
  const expectedTotal = flow.platformFeeAmount + flow.ownerNetAmount;
  const collectedTotal = flow.grossAmount + flow.tipAmount;

  if (flow.grossAmount < 0 || flow.tipAmount < 0 || flow.platformFeeAmount < 0 || flow.processorFeeAmount < 0 || flow.ownerNetAmount < 0) issues.push('negative_amount');
  if (expectedTotal > collectedTotal) issues.push('amount_mismatch');
  if (flow.ownerNetAmount > expectedOwnerNet) issues.push('owner_net_exceeds_available_amount');
  if (flow.paymentStatus === 'succeeded' && flow.processorFeeAmount === 0) issues.push('processor_fee_pending');
  if (flow.paymentStatus === 'succeeded' && flow.platformFeeAmount !== flow.tipAmount) issues.push('platform_fee_mismatch');
  if (flow.paymentStatus === 'succeeded' && flow.transferStatus === 'pending') issues.push('owner_transfer_pending');
  if (flow.paymentStatus === 'succeeded' && ['requested', 'approved', 'pending'].includes(flow.payoutStatus)) issues.push('payout_pending');
  if (flow.paymentStatus === 'failed') issues.push('payment_failed');
  if (flow.payoutStatus === 'failed') issues.push('payout_failed');
  if (flow.refundStatus === 'partial' || flow.refundStatus === 'full') issues.push('refund_recorded');
  if (flow.disputeStatus !== 'none') issues.push('dispute_recorded');

  if (issues.includes('amount_mismatch') || issues.includes('owner_net_exceeds_available_amount') || issues.includes('negative_amount')) return { status: 'mismatch', issues };
  if (issues.includes('payment_failed') || issues.includes('payout_failed')) return { status: 'failed', issues };
  if (issues.includes('refund_recorded') || issues.includes('dispute_recorded')) return { status: 'needs_review', issues };
  if (issues.length > 0) return { status: 'pending_data', issues };
  return { status: 'reconciled', issues };
}

// PostgREST puts `.in('col', [...])` values in the URL — large id lists overflow header limits.
// Fetch in chunks and concatenate results.
async function fetchInChunks(table, select, column, ids, chunkSize = 100) {
  const rows = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase.from(table).select(select).in(column, chunk);
    if (error) throw error;
    rows.push(...(data ?? []));
  }
  return rows;
}

async function main() {
  console.log(apply ? 'Running backfill in APPLY mode (rows will be written)...' : 'Running backfill in DRY-RUN mode (pass --apply to write rows)...');

  const { data: donations, error: donationsError } = await supabase
    .from('donations')
    .select('id,campaign_id,donor_id,amount_cents,tip_cents,processing_fee_cents,status,stripe_payment_intent_id,stripe_checkout_session_id,refunded_at,created_at,updated_at')
    .order('created_at', { ascending: true });
  if (donationsError) throw donationsError;
  if (!donations?.length) {
    console.log('No donations found — nothing to backfill.');
    return;
  }

  // Skip donations that never reached Stripe (no payment intent / checkout session) —
  // they have no real money movement to reconstruct.
  const candidates = donations.filter((d) => d.stripe_payment_intent_id || d.stripe_checkout_session_id);
  console.log(`Found ${donations.length} donations (${candidates.length} with a Stripe payment intent / checkout session).`);

  const { data: existingPayments, error: existingError } = await supabase
    .from('campaign_payments')
    .select('donation_id,processor_payment_intent_id,processor_checkout_session_id');
  if (existingError) throw existingError;

  const existingByDonationId = new Set((existingPayments ?? []).map((p) => p.donation_id).filter(Boolean));
  const existingByIntentId = new Set((existingPayments ?? []).map((p) => p.processor_payment_intent_id).filter(Boolean));
  const existingBySessionId = new Set((existingPayments ?? []).map((p) => p.processor_checkout_session_id).filter(Boolean));

  const pending = candidates.filter((d) =>
    !existingByDonationId.has(d.id) &&
    !(d.stripe_payment_intent_id && existingByIntentId.has(d.stripe_payment_intent_id)) &&
    !(d.stripe_checkout_session_id && existingBySessionId.has(d.stripe_checkout_session_id)));

  console.log(`${candidates.length - pending.length} already present in campaign_payments; ${pending.length} to backfill.`);
  if (!pending.length) return;

  const campaignIds = [...new Set(pending.map((d) => d.campaign_id).filter(Boolean))];
  const campaigns = await fetchInChunks('campaigns', 'id,user_id', 'id', campaignIds);
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  // Stripe Connect account info lives on `connected_accounts` (keyed by user_id), not `profiles`.
  const ownerIds = [...new Set(campaigns.map((c) => c.user_id).filter(Boolean))];
  const connectedAccounts = await fetchInChunks('connected_accounts', 'user_id,stripe_account_id,charges_enabled,payouts_enabled', 'user_id', ownerIds);
  const connectedAccountByOwnerId = new Map(connectedAccounts.map((a) => [a.user_id, a]));

  let inserted = 0;
  let skipped = 0;

  for (const donation of pending) {
    const campaign = campaignById.get(donation.campaign_id);
    if (!campaign) { skipped += 1; continue; }
    const connectedAccount = connectedAccountByOwnerId.get(campaign.user_id);
    const hasConnected = Boolean(connectedAccount?.stripe_account_id && connectedAccount?.charges_enabled && connectedAccount?.payouts_enabled);

    const grossAmount = donation.amount_cents;
    const tipAmount = donation.tip_cents ?? 0;
    const processorFeeAmount = 0; // Historical donations didn't capture processor fees; live webhook backfills these post-charge.
    const platformFeeAmount = tipAmount; // CharitMe takes 0% platform fee — donor tips are the platform's revenue (matches webhook logic).
    const ownerNetAmount = grossAmount;
    const paymentStatus = mapPaymentStatus(donation.status);
    const refundedAmount = donation.status === 'refunded' ? grossAmount : 0;
    const disputedAmount = donation.status === 'disputed' ? grossAmount : 0;
    const refundStatus = donation.status === 'refunded' ? 'full' : 'none';
    const disputeStatus = donation.status === 'disputed' ? 'opened' : 'none';
    const transferStatus = paymentStatus !== 'succeeded' ? 'not_applicable' : (hasConnected ? 'created' : 'pending');
    const payoutStatus = paymentStatus !== 'succeeded' ? 'not_applicable' : (hasConnected ? 'requested' : 'not_applicable');

    const reconciliation = reconcile({
      grossAmount, tipAmount, processorFeeAmount, platformFeeAmount, ownerNetAmount,
      refundedAmount, disputedAmount, paymentStatus, transferStatus, payoutStatus,
      refundStatus, disputeStatus, settlementStatus: 'pending',
    });

    const row = {
      donation_id: donation.id,
      campaign_id: donation.campaign_id,
      campaign_owner_id: campaign.user_id,
      donor_id: donation.donor_id,
      processor: 'stripe',
      processor_account_id: connectedAccount?.stripe_account_id ?? null,
      processor_payment_intent_id: donation.stripe_payment_intent_id,
      processor_checkout_session_id: donation.stripe_checkout_session_id,
      gross_amount: grossAmount,
      tip_amount: tipAmount,
      processor_fee_amount: processorFeeAmount,
      platform_fee_amount: platformFeeAmount,
      campaign_owner_net_amount: ownerNetAmount,
      refunded_amount: refundedAmount,
      disputed_amount: disputedAmount,
      currency: 'usd',
      payment_status: paymentStatus,
      transfer_status: transferStatus,
      payout_status: payoutStatus,
      refund_status: refundStatus,
      dispute_status: disputeStatus,
      settlement_status: 'pending',
      reconciliation_status: reconciliation.status,
      reconciliation_reason: reconciliation.issues.join(', '),
      paid_at: paymentStatus === 'succeeded' ? donation.created_at : null,
      metadata: { backfilled: true, source: 'donations', donation_status: donation.status },
      created_at: donation.created_at,
      updated_at: donation.updated_at ?? donation.created_at,
    };

    if (!apply) {
      console.log(`[dry-run] would insert campaign_payment for donation ${donation.id} (gross=${grossAmount}, status=${paymentStatus}, reconciliation=${reconciliation.status})`);
      inserted += 1;
      continue;
    }

    const { data: insertedRow, error: insertError } = await supabase
      .from('campaign_payments')
      .insert(row)
      .select('id')
      .maybeSingle();
    if (insertError || !insertedRow?.id) {
      console.error(`Failed to insert campaign_payment for donation ${donation.id}:`, insertError?.message);
      skipped += 1;
      continue;
    }
    const paymentId = insertedRow.id;

    await Promise.all([
      supabase.from('campaign_payment_breakdowns').insert({
        campaign_payment_id: paymentId,
        campaign_id: donation.campaign_id,
        campaign_owner_id: campaign.user_id,
        donor_id: donation.donor_id,
        processor: 'stripe',
        processor_account_id: connectedAccount?.stripe_account_id ?? null,
        gross_amount: grossAmount,
        tip_amount: tipAmount,
        processor_fee_amount: processorFeeAmount,
        platform_fee_amount: platformFeeAmount,
        owner_net_amount: ownerNetAmount,
        currency: 'usd',
        status: reconciliation.status === 'pending_data' ? 'pending_data' : 'current',
        metadata: { backfilled: true },
      }),
      supabase.from('campaign_platform_fees').insert({
        campaign_payment_id: paymentId,
        campaign_id: donation.campaign_id,
        campaign_owner_id: campaign.user_id,
        donor_id: donation.donor_id,
        processor: 'stripe',
        processor_account_id: connectedAccount?.stripe_account_id ?? null,
        processor_object_id: donation.stripe_payment_intent_id ?? donation.stripe_checkout_session_id ?? null,
        gross_amount: grossAmount,
        platform_fee_amount: platformFeeAmount,
        currency: 'usd',
        status: platformFeeAmount > 0 ? 'recorded' : 'pending',
        metadata: { backfilled: true },
      }),
      supabase.from('campaign_payment_reconciliation').upsert({
        campaign_payment_id: paymentId,
        campaign_id: donation.campaign_id,
        campaign_owner_id: campaign.user_id,
        donor_id: donation.donor_id,
        processor: 'stripe',
        processor_account_id: connectedAccount?.stripe_account_id ?? null,
        gross_amount: grossAmount,
        processor_fee_amount: processorFeeAmount,
        platform_fee_amount: platformFeeAmount,
        owner_net_amount: ownerNetAmount,
        currency: 'usd',
        status: reconciliation.status,
        issues: reconciliation.issues,
        metadata: { backfilled: true },
        checked_at: new Date().toISOString(),
      }, { onConflict: 'campaign_payment_id', ignoreDuplicates: false }),
    ]);

    inserted += 1;
    if (inserted % 25 === 0) console.log(`...${inserted} backfilled so far`);
  }

  console.log(`Done. ${apply ? 'Inserted' : 'Would insert'} ${inserted} campaign_payments row(s); skipped ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
