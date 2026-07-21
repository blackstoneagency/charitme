import 'server-only';
import { supabaseAdmin } from './supabase';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed';

export type ReconciliationStatus =
  | 'reconciled'
  | 'pending_data'
  | 'mismatch'
  | 'failed'
  | 'needs_review'
  | 'ignored';

export type MoneyFlowSnapshot = {
  grossAmount: number;
  tipAmount: number;
  processorFeeAmount: number;
  platformFeeAmount: number;
  ownerNetAmount: number;
  refundedAmount: number;
  disputedAmount: number;
  paymentStatus: PaymentStatus;
  transferStatus: string;
  payoutStatus: string;
  refundStatus: string;
  disputeStatus: string;
  settlementStatus: string;
};

export type ReconciliationResult = {
  status: ReconciliationStatus;
  issues: string[];
};

export type CampaignPaymentInput = {
  campaignId: string;
  campaignOwnerId: string | null;
  donorId: string | null;
  donationId: string | null;
  processor: 'stripe' | 'paypal' | 'manual' | 'other';
  processorAccountId: string | null;
  processorChargeId?: string | null;
  processorPaymentIntentId?: string | null;
  processorCheckoutSessionId?: string | null;
  processorTransferId?: string | null;
  processorPayoutId?: string | null;
  grossAmount: number;
  tipAmount: number;
  processorFeeAmount: number;
  platformFeeAmount: number;
  ownerNetAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  transferStatus: string;
  payoutStatus: string;
  refundStatus?: string;
  disputeStatus?: string;
  settlementStatus?: string;
  paidAt?: string | null;
  availableOn?: string | null;
  payoutAt?: string | null;
  webhookEventId?: string | null;
  metadata?: Record<string, unknown>;
};

export type PaymentFlowSummary = {
  totalGross: number;
  totalPlatformRevenue: number;
  totalProcessorFees: number;
  totalOwnerNet: number;
  totalPaidOut: number;
  totalPendingPayout: number;
  failedPayments: number;
  totalRefunds: number;
  totalDisputes: number;
  unreconciled: number;
};

export type AdminPaymentRow = {
  id: string;
  campaign_id: string | null;
  campaign_owner_id: string | null;
  processor: string;
  processor_charge_id: string | null;
  processor_payment_intent_id: string | null;
  processor_checkout_session_id: string | null;
  processor_transfer_id: string | null;
  processor_payout_id: string | null;
  gross_amount: number;
  tip_amount: number;
  platform_fee_amount: number;
  processor_fee_amount: number;
  campaign_owner_net_amount: number;
  refunded_amount: number;
  disputed_amount: number;
  currency: string;
  payment_status: string;
  transfer_status: string;
  payout_status: string;
  refund_status: string;
  dispute_status: string;
  settlement_status: string;
  reconciliation_status: string;
  reconciliation_reason: string | null;
  created_at: string;
  campaigns?: { title: string | null; slug: string | null } | null;
  owner?: { full_name: string | null; email: string | null } | null;
};

export function reconcileMoneyFlow(flow: MoneyFlowSnapshot): ReconciliationResult {
  const issues: string[] = [];
  const expectedOwnerNet = flow.grossAmount - flow.refundedAmount - flow.disputedAmount;
  const expectedTotal = flow.platformFeeAmount + flow.ownerNetAmount;
  const collectedTotal = flow.grossAmount + flow.tipAmount;

  if (flow.grossAmount < 0 || flow.tipAmount < 0 || flow.platformFeeAmount < 0 || flow.processorFeeAmount < 0 || flow.ownerNetAmount < 0) {
    issues.push('negative_amount');
  }
  if (expectedTotal > collectedTotal) {
    issues.push('amount_mismatch');
  }
  if (flow.ownerNetAmount > expectedOwnerNet) {
    issues.push('owner_net_exceeds_available_amount');
  }
  if (flow.paymentStatus === 'succeeded' && flow.processorFeeAmount === 0) {
    issues.push('processor_fee_pending');
  }
  if (flow.paymentStatus === 'succeeded' && flow.platformFeeAmount !== flow.tipAmount) {
    issues.push('platform_fee_mismatch');
  }
  if (flow.paymentStatus === 'succeeded' && flow.transferStatus === 'pending') {
    issues.push('owner_transfer_pending');
  }
  if (flow.paymentStatus === 'succeeded' && ['requested', 'approved', 'pending'].includes(flow.payoutStatus)) {
    issues.push('payout_pending');
  }
  if (flow.paymentStatus === 'failed') {
    issues.push('payment_failed');
  }
  if (flow.payoutStatus === 'failed') {
    issues.push('payout_failed');
  }
  if (flow.refundStatus === 'partial' || flow.refundStatus === 'full') {
    issues.push('refund_recorded');
  }
  if (flow.disputeStatus !== 'none') {
    issues.push('dispute_recorded');
  }

  if (issues.includes('amount_mismatch') || issues.includes('owner_net_exceeds_available_amount') || issues.includes('negative_amount')) {
    return { status: 'mismatch', issues };
  }
  if (issues.includes('payment_failed') || issues.includes('payout_failed')) {
    return { status: 'failed', issues };
  }
  if (issues.includes('refund_recorded') || issues.includes('dispute_recorded')) {
    return { status: 'needs_review', issues };
  }
  if (issues.length > 0) {
    return { status: 'pending_data', issues };
  }
  return { status: 'reconciled', issues };
}

export function summarizePaymentRows(rows: AdminPaymentRow[]): PaymentFlowSummary {
  return rows.reduce<PaymentFlowSummary>((summary, row) => ({
    totalGross: summary.totalGross + row.gross_amount,
    totalPlatformRevenue: summary.totalPlatformRevenue + row.platform_fee_amount,
    totalProcessorFees: summary.totalProcessorFees + row.processor_fee_amount,
    totalOwnerNet: summary.totalOwnerNet + row.campaign_owner_net_amount,
    totalPaidOut: summary.totalPaidOut + (row.payout_status === 'paid' ? row.campaign_owner_net_amount : 0),
    totalPendingPayout: summary.totalPendingPayout + (['requested', 'approved', 'pending'].includes(row.payout_status) ? row.campaign_owner_net_amount : 0),
    failedPayments: summary.failedPayments + (row.payment_status === 'failed' ? 1 : 0),
    totalRefunds: summary.totalRefunds + row.refunded_amount,
    totalDisputes: summary.totalDisputes + row.disputed_amount,
    unreconciled: summary.unreconciled + (row.reconciliation_status === 'reconciled' ? 0 : 1),
  }), {
    totalGross: 0,
    totalPlatformRevenue: 0,
    totalProcessorFees: 0,
    totalOwnerNet: 0,
    totalPaidOut: 0,
    totalPendingPayout: 0,
    failedPayments: 0,
    totalRefunds: 0,
    totalDisputes: 0,
    unreconciled: 0,
  });
}

export function formatPaymentCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function asPositiveCents(value: number): number {
  return Math.max(0, Math.round(value));
}

export async function recordCampaignPayment(input: CampaignPaymentInput): Promise<string | null> {
  const reconciliation = reconcileMoneyFlow({
    grossAmount: input.grossAmount,
    tipAmount: input.tipAmount,
    processorFeeAmount: input.processorFeeAmount,
    platformFeeAmount: input.platformFeeAmount,
    ownerNetAmount: input.ownerNetAmount,
    refundedAmount: 0,
    disputedAmount: 0,
    paymentStatus: input.paymentStatus,
    transferStatus: input.transferStatus,
    payoutStatus: input.payoutStatus,
    refundStatus: input.refundStatus ?? 'none',
    disputeStatus: input.disputeStatus ?? 'none',
    settlementStatus: input.settlementStatus ?? 'pending',
  });

  const row = {
    donation_id: input.donationId,
    campaign_id: input.campaignId,
    campaign_owner_id: input.campaignOwnerId,
    donor_id: input.donorId,
    processor: input.processor,
    processor_account_id: input.processorAccountId,
    processor_charge_id: input.processorChargeId ?? null,
    processor_payment_intent_id: input.processorPaymentIntentId ?? null,
    processor_checkout_session_id: input.processorCheckoutSessionId ?? null,
    processor_transfer_id: input.processorTransferId ?? null,
    processor_payout_id: input.processorPayoutId ?? null,
    gross_amount: asPositiveCents(input.grossAmount),
    tip_amount: asPositiveCents(input.tipAmount),
    processor_fee_amount: asPositiveCents(input.processorFeeAmount),
    platform_fee_amount: asPositiveCents(input.platformFeeAmount),
    campaign_owner_net_amount: asPositiveCents(input.ownerNetAmount),
    currency: input.currency.toLowerCase(),
    payment_status: input.paymentStatus,
    transfer_status: input.transferStatus,
    payout_status: input.payoutStatus,
    refund_status: input.refundStatus ?? 'none',
    dispute_status: input.disputeStatus ?? 'none',
    settlement_status: input.settlementStatus ?? 'pending',
    reconciliation_status: reconciliation.status,
    reconciliation_reason: reconciliation.issues.join(', '),
    paid_at: input.paidAt ?? null,
    available_on: input.availableOn ?? null,
    payout_at: input.payoutAt ?? null,
    last_webhook_event_id: input.webhookEventId ?? null,
    metadata: input.metadata ?? {},
  };

  const lookup = input.processorPaymentIntentId
    ? supabaseAdmin
      .from('campaign_payments')
      .select('id')
      .eq('processor', input.processor)
      .eq('processor_payment_intent_id', input.processorPaymentIntentId)
      .maybeSingle()
    : supabaseAdmin
      .from('campaign_payments')
      .select('id')
      .eq('processor', input.processor)
      .eq('processor_checkout_session_id', input.processorCheckoutSessionId ?? '')
      .maybeSingle();

  const { data: existing } = await lookup;
  const isNewPayment = !existing?.id;
  const write = existing?.id
    ? supabaseAdmin.from('campaign_payments').update(row).eq('id', existing.id).select('id').maybeSingle()
    : supabaseAdmin.from('campaign_payments').insert(row).select('id').maybeSingle();

  const { data, error } = await write;

  if (error || !data?.id) return null;
  const paymentId = String(data.id);

  // The reconciliation row is keyed 1:1 to the payment (upsert) so it is always
  // safe to refresh. The breakdown / platform-fee / processor-fee detail rows are
  // append-only `insert`s, so they must only be written when the parent payment is
  // FIRST created — re-running for an existing payment (e.g. a future second
  // caller, or a re-record) would otherwise duplicate them. Fee corrections after
  // the fact are handled by the idempotent upserts in handleChargeObserved.
  const detailWrites: Array<PromiseLike<unknown>> = [
    supabaseAdmin.from('campaign_payment_reconciliation').upsert({
      campaign_payment_id: paymentId,
      campaign_id: input.campaignId,
      campaign_owner_id: input.campaignOwnerId,
      donor_id: input.donorId,
      processor: input.processor,
      processor_account_id: input.processorAccountId,
      gross_amount: input.grossAmount,
      processor_fee_amount: input.processorFeeAmount,
      platform_fee_amount: input.platformFeeAmount,
      owner_net_amount: input.ownerNetAmount,
      currency: input.currency.toLowerCase(),
      status: reconciliation.status,
      issues: reconciliation.issues,
      metadata: input.metadata ?? {},
      checked_at: new Date().toISOString(),
    }, { onConflict: 'campaign_payment_id', ignoreDuplicates: false }),
  ];

  if (isNewPayment) {
    detailWrites.push(
      supabaseAdmin.from('campaign_payment_breakdowns').insert({
        campaign_payment_id: paymentId,
        campaign_id: input.campaignId,
        campaign_owner_id: input.campaignOwnerId,
        donor_id: input.donorId,
        processor: input.processor,
        processor_account_id: input.processorAccountId,
        gross_amount: input.grossAmount,
        tip_amount: input.tipAmount,
        processor_fee_amount: input.processorFeeAmount,
        platform_fee_amount: input.platformFeeAmount,
        owner_net_amount: input.ownerNetAmount,
        currency: input.currency.toLowerCase(),
        status: reconciliation.status === 'pending_data' ? 'pending_data' : 'current',
        metadata: input.metadata ?? {},
      }),
      supabaseAdmin.from('campaign_platform_fees').insert({
        campaign_payment_id: paymentId,
        campaign_id: input.campaignId,
        campaign_owner_id: input.campaignOwnerId,
        donor_id: input.donorId,
        processor: input.processor,
        processor_account_id: input.processorAccountId,
        processor_object_id: input.processorPaymentIntentId ?? input.processorCheckoutSessionId ?? null,
        gross_amount: input.grossAmount,
        platform_fee_amount: input.platformFeeAmount,
        currency: input.currency.toLowerCase(),
        status: input.platformFeeAmount > 0 ? 'recorded' : 'pending',
        metadata: input.metadata ?? {},
      }),
      supabaseAdmin.from('campaign_processor_fees').insert({
        campaign_payment_id: paymentId,
        campaign_id: input.campaignId,
        campaign_owner_id: input.campaignOwnerId,
        donor_id: input.donorId,
        processor: input.processor,
        processor_account_id: input.processorAccountId,
        processor_object_id: input.processorChargeId ?? input.processorPaymentIntentId ?? input.processorCheckoutSessionId ?? null,
        gross_amount: input.grossAmount,
        processor_fee_amount: input.processorFeeAmount,
        currency: input.currency.toLowerCase(),
        status: input.processorFeeAmount > 0 ? 'recorded' : 'pending',
        metadata: input.metadata ?? {},
      }),
    );
  }

  await Promise.all(detailWrites);

  return paymentId;
}

export async function recordPaymentEvent(input: {
  campaignPaymentId: string | null;
  campaignId: string | null;
  campaignOwnerId: string | null;
  donorId: string | null;
  processor: 'stripe' | 'paypal' | 'manual' | 'other';
  processorAccountId: string | null;
  processorObjectId: string | null;
  eventType: string;
  eventStatus: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from('campaign_payment_events').upsert({
    campaign_payment_id: input.campaignPaymentId,
    campaign_id: input.campaignId,
    campaign_owner_id: input.campaignOwnerId,
    donor_id: input.donorId,
    processor: input.processor,
    processor_account_id: input.processorAccountId,
    processor_object_id: input.processorObjectId,
    event_type: input.eventType,
    event_status: input.eventStatus,
    amount: asPositiveCents(input.amount),
    currency: input.currency.toLowerCase(),
    metadata: input.metadata ?? {},
    occurred_at: new Date().toISOString(),
  }, { onConflict: 'processor,processor_object_id,event_type', ignoreDuplicates: false });
}
