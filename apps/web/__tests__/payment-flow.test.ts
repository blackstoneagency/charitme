import { describe, expect, it } from 'vitest';
import { paymentStatusTone, reconcileMoneyFlow, summarizePaymentRows, type AdminPaymentRow } from '../lib/payment-flow-core';

describe('campaign payment reconciliation', () => {
  it('maps payment states to theme-safe semantic text tokens', () => {
    expect(paymentStatusTone('succeeded')).toBe('var(--green-text)');
    expect(paymentStatusTone('failed')).toBe('var(--red-text)');
    expect(paymentStatusTone('pending_data')).toBe('var(--orange-text)');
    expect(paymentStatusTone('none')).toBe('var(--t3)');
  });

  it('keeps successful Stripe payments pending until the real processor fee arrives', () => {
    const result = reconcileMoneyFlow({
      grossAmount: 10000,
      tipAmount: 500,
      platformFeeAmount: 500,
      processorFeeAmount: 0,
      ownerNetAmount: 10000,
      refundedAmount: 0,
      disputedAmount: 0,
      paymentStatus: 'succeeded',
      transferStatus: 'created',
      payoutStatus: 'requested',
      refundStatus: 'none',
      disputeStatus: 'none',
      settlementStatus: 'pending',
    });

    expect(result.status).toBe('pending_data');
    expect(result.issues).toContain('processor_fee_pending');
    expect(result.issues).toContain('payout_pending');
  });

  it('marks a fully observed payment flow as reconciled', () => {
    const result = reconcileMoneyFlow({
      grossAmount: 10000,
      tipAmount: 500,
      platformFeeAmount: 500,
      processorFeeAmount: 320,
      ownerNetAmount: 10000,
      refundedAmount: 0,
      disputedAmount: 0,
      paymentStatus: 'succeeded',
      transferStatus: 'created',
      payoutStatus: 'paid',
      refundStatus: 'none',
      disputeStatus: 'none',
      settlementStatus: 'paid_out',
    });

    expect(result).toEqual({ status: 'reconciled', issues: [] });
  });

  it('flags refunds, disputes, and failed payouts for finance review', () => {
    const refund = reconcileMoneyFlow({
      grossAmount: 10000,
      tipAmount: 500,
      platformFeeAmount: 500,
      processorFeeAmount: 320,
      ownerNetAmount: 7000,
      refundedAmount: 3000,
      disputedAmount: 0,
      paymentStatus: 'partially_refunded',
      transferStatus: 'created',
      payoutStatus: 'paid',
      refundStatus: 'partial',
      disputeStatus: 'none',
      settlementStatus: 'paid_out',
    });
    const payoutFailure = reconcileMoneyFlow({
      grossAmount: 10000,
      tipAmount: 500,
      platformFeeAmount: 500,
      processorFeeAmount: 320,
      ownerNetAmount: 10000,
      refundedAmount: 0,
      disputedAmount: 0,
      paymentStatus: 'succeeded',
      transferStatus: 'created',
      payoutStatus: 'failed',
      refundStatus: 'none',
      disputeStatus: 'none',
      settlementStatus: 'failed',
    });

    expect(refund.status).toBe('needs_review');
    expect(refund.issues).toContain('refund_recorded');
    expect(payoutFailure.status).toBe('failed');
    expect(payoutFailure.issues).toContain('payout_failed');
  });
});

describe('campaign payment summaries', () => {
  it('aggregates admin dashboard totals from canonical rows', () => {
    const rows = [
      row({ gross_amount: 10000, platform_fee_amount: 500, processor_fee_amount: 320, campaign_owner_net_amount: 10000, payout_status: 'paid', reconciliation_status: 'reconciled' }),
      row({ gross_amount: 2500, platform_fee_amount: 100, processor_fee_amount: 90, campaign_owner_net_amount: 2500, payout_status: 'requested', refunded_amount: 500, disputed_amount: 0, reconciliation_status: 'pending_data' }),
      row({ gross_amount: 7500, platform_fee_amount: 0, processor_fee_amount: 0, campaign_owner_net_amount: 0, payout_status: 'failed', payment_status: 'failed', disputed_amount: 7500, reconciliation_status: 'failed' }),
    ];

    expect(summarizePaymentRows(rows)).toMatchObject({
      totalGross: 20000,
      totalPlatformRevenue: 600,
      totalProcessorFees: 410,
      totalOwnerNet: 12500,
      totalPaidOut: 10000,
      totalPendingPayout: 2500,
      failedPayments: 1,
      totalRefunds: 500,
      totalDisputes: 7500,
      unreconciled: 2,
    });
  });
});

function row(overrides: Partial<AdminPaymentRow>): AdminPaymentRow {
  const base = {
    id: crypto.randomUUID(),
    campaign_id: crypto.randomUUID(),
    campaign_owner_id: crypto.randomUUID(),
    processor: 'stripe',
    processor_charge_id: null,
    processor_payment_intent_id: null,
    processor_checkout_session_id: null,
    processor_transfer_id: null,
    processor_payout_id: null,
    gross_amount: 0,
    tip_amount: 0,
    platform_fee_amount: 0,
    processor_fee_amount: 0,
    campaign_owner_net_amount: 0,
    refunded_amount: 0,
    disputed_amount: 0,
    currency: 'usd',
    payment_status: 'succeeded',
    transfer_status: 'created',
    payout_status: 'paid',
    refund_status: 'none',
    dispute_status: 'none',
    settlement_status: 'paid_out',
    reconciliation_status: 'reconciled',
    reconciliation_reason: null,
    created_at: new Date(0).toISOString(),
    ...overrides,
  };
  return { ...base, processor_charge_id: base.processor_charge_id ?? null };
}
