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
