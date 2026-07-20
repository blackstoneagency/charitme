import 'server-only';
// ─────────────────────────────────────────────────────────────────────────────
// Financial ledger — Supabase data access. Pure double-entry logic in
// `ledger-core.ts`. Writes use the service role; the DB trigger enforces
// append-only immutability, and a unique index enforces idempotency.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase';
import {
  assertBalanced,
  buildDonationEntries,
  buildRefundEntries,
  buildDisputeLossEntries,
  type LedgerLine,
  type DonationSplit,
  type RefundInput,
} from './ledger-core';

export interface LedgerMeta {
  eventType: 'donation' | 'refund' | 'partial_refund' | 'dispute' | 'payout' | 'adjustment';
  currency?: string;
  campaignId?: string | null;
  donationId?: string | null;
  recipientUserId?: string | null;
  connectedAccountId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeRefundId?: string | null;
  /** Stable key so duplicate webhook deliveries never double-post. */
  idempotencyKey: string;
  correlationId?: string | null;
  source?: string;
}

/**
 * Post a balanced group of ledger lines. Validates the balance first (throws if
 * unbalanced), then inserts all lines sharing one entry_group_id. Duplicate posts
 * (same idempotency_key) are absorbed by the unique index and reported as skipped.
 */
export async function postEntryGroup(
  lines: LedgerLine[],
  meta: LedgerMeta,
): Promise<{ posted: boolean; groupId: string }> {
  assertBalanced(lines);
  const groupId = randomUUID();
  const rows = lines.map((l) => ({
    entry_group_id: groupId,
    account: l.account,
    direction: l.direction,
    amount_cents: l.amount_cents,
    currency: (meta.currency ?? 'usd').toLowerCase(),
    event_type: meta.eventType,
    campaign_id: meta.campaignId ?? null,
    donation_id: meta.donationId ?? null,
    recipient_user_id: meta.recipientUserId ?? null,
    connected_account_id: meta.connectedAccountId ?? null,
    stripe_payment_intent_id: meta.stripePaymentIntentId ?? null,
    stripe_charge_id: meta.stripeChargeId ?? null,
    stripe_refund_id: meta.stripeRefundId ?? null,
    idempotency_key: meta.idempotencyKey,
    correlation_id: meta.correlationId ?? null,
    source: meta.source ?? 'webhook',
  }));

  const { error } = await supabaseAdmin.from('ledger_entries').insert(rows);
  if (error) {
    if (error.code === '23505') return { posted: false, groupId }; // already posted (idempotent)
    throw new Error(`ledger post failed: ${error.message}`);
  }
  return { posted: true, groupId };
}

/** Convenience: post a donation split. Best-effort friendly (throws on real errors). */
export async function postDonation(split: DonationSplit, meta: Omit<LedgerMeta, 'eventType'>) {
  return postEntryGroup(buildDonationEntries(split), { ...meta, eventType: 'donation' });
}

/** Convenience: post a refund reversal. */
export async function postRefund(input: RefundInput, meta: Omit<LedgerMeta, 'eventType'>) {
  return postEntryGroup(buildRefundEntries(input), { ...meta, eventType: 'refund' });
}

/** Convenience: post a chargeback (lost-dispute) reversal into the disputes account. */
export async function postDisputeLoss(input: RefundInput, meta: Omit<LedgerMeta, 'eventType'>) {
  return postEntryGroup(buildDisputeLossEntries(input), { ...meta, eventType: 'dispute' });
}

export interface LedgerRow extends LedgerLine {
  id: string;
  entry_group_id: string;
  event_type: string;
  currency: string;
  donation_id: string | null;
  campaign_id: string | null;
  occurred_at: string;
}

export async function getDonationLedger(donationId: string): Promise<LedgerRow[]> {
  const { data } = await supabaseAdmin
    .from('ledger_entries')
    .select('id, entry_group_id, account, direction, amount_cents, event_type, currency, donation_id, campaign_id, occurred_at')
    .eq('donation_id', donationId)
    .order('occurred_at', { ascending: true });
  return (data ?? []) as LedgerRow[];
}

export async function getCampaignLedger(campaignId: string, limit = 500): Promise<LedgerRow[]> {
  const { data } = await supabaseAdmin
    .from('ledger_entries')
    .select('id, entry_group_id, account, direction, amount_cents, event_type, currency, donation_id, campaign_id, occurred_at')
    .eq('campaign_id', campaignId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as LedgerRow[];
}

export interface ReconciliationException {
  kind: 'amount_mismatch' | 'missing_ledger' | 'missing_stripe' | 'unbalanced_group' | 'duplicate' | 'fee_mismatch' | 'payout_mismatch' | 'other';
  description: string;
  campaignId?: string | null;
  donationId?: string | null;
  stripeRef?: string | null;
  expectedCents?: number | null;
  actualCents?: number | null;
}

/**
 * Record a reconciliation exception. When a `stripeRef` is supplied, this is
 * idempotent: it will not open a second OPEN exception of the same kind for the
 * same ref (so retried webhooks don't pile up duplicates).
 */
export async function openReconciliationException(x: ReconciliationException): Promise<void> {
  if (x.stripeRef) {
    const { data: existing } = await supabaseAdmin
      .from('reconciliation_exceptions')
      .select('id')
      .eq('status', 'open')
      .eq('kind', x.kind)
      .eq('stripe_ref', x.stripeRef)
      .limit(1);
    if (existing && existing.length) return; // already flagged, don't duplicate
  }
  const difference =
    x.expectedCents != null && x.actualCents != null ? x.expectedCents - x.actualCents : null;
  await supabaseAdmin.from('reconciliation_exceptions').insert({
    kind: x.kind,
    description: x.description,
    campaign_id: x.campaignId ?? null,
    donation_id: x.donationId ?? null,
    stripe_ref: x.stripeRef ?? null,
    expected_cents: x.expectedCents ?? null,
    actual_cents: x.actualCents ?? null,
    difference_cents: difference,
  });
}
