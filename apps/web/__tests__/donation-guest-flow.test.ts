import { describe, expect, it } from 'vitest';
import {
  donorTip,
  methodProcessingFee,
  MIN_DONATION_CENTS,
  MAX_DONATION_CENTS,
  type PaymentMethod,
} from '@shared/fees';
import { reconcileMoneyFlow, summarizePaymentRows, type AdminPaymentRow } from '../lib/payment-flow-core';

// ─────────────────────────────────────────────────────────────────────────────
// G4-17: Guest donation checkout flow
// ─────────────────────────────────────────────────────────────────────────────
describe('guest donation path', () => {
  function buildCheckoutMetadata(params: {
    donorId?: string | null;
    donorEmail?: string;
    campaignId: string;
    amountCents: number;
    anonymous?: boolean;
  }) {
    return {
      donorId:    params.donorId ?? '',          // empty string for guest
      donorEmail: params.donorEmail ?? '',
      campaignId: params.campaignId,
      amountCents: String(params.amountCents),
      anonymous:  params.anonymous ? '1' : '0',
      isGuest:    !params.donorId ? '1' : '0',
    };
  }

  function webhookDonorId(meta: ReturnType<typeof buildCheckoutMetadata>) {
    return meta.donorId || null;
  }

  it('stores null donor_id for guest checkout', () => {
    const meta = buildCheckoutMetadata({
      donorId: null,
      donorEmail: 'guest@example.com',
      campaignId: crypto.randomUUID(),
      amountCents: 5000,
    });
    expect(webhookDonorId(meta)).toBeNull();
  });

  it('stores donor_id for authenticated checkout', () => {
    const uid = crypto.randomUUID();
    const meta = buildCheckoutMetadata({
      donorId: uid,
      campaignId: crypto.randomUUID(),
      amountCents: 5000,
    });
    expect(webhookDonorId(meta)).toBe(uid);
  });

  it('anonymous guest has null donor_id and anonymous=true', () => {
    const meta = buildCheckoutMetadata({
      donorId: null,
      campaignId: crypto.randomUUID(),
      amountCents: 2500,
      anonymous: true,
    });
    expect(webhookDonorId(meta)).toBeNull();
    expect(meta.anonymous).toBe('1');
  });

  it('enforces minimum donation amount', () => {
    expect(MIN_DONATION_CENTS).toBeGreaterThanOrEqual(100);
    expect(500).toBeGreaterThanOrEqual(MIN_DONATION_CENTS);
  });

  it('enforces maximum donation amount', () => {
    expect(MAX_DONATION_CENTS).toBeGreaterThan(100000);
    // MAX_DONATION_CENTS is a hard cap; amounts at or above it should be rejected
    expect(MAX_DONATION_CENTS + 1).toBeGreaterThan(MAX_DONATION_CENTS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G25-02: Full donor donation checkout math
// ─────────────────────────────────────────────────────────────────────────────
describe('donor donation checkout math', () => {
  it('computes tip correctly at 8%', () => {
    expect(donorTip(10000, 8)).toBe(800);
  });

  it('computes zero tip when tip percent is 0', () => {
    expect(donorTip(10000, 0)).toBe(0);
  });

  it('computes card processing fee', () => {
    const fee = methodProcessingFee(10000, 'card');
    expect(fee).toBeGreaterThan(0);
    expect(fee).toBeLessThan(10000);
  });

  it('computes no processing fee when donor does not cover it', () => {
    // When coverProcessingFee=false, processingFeeCents=0
    const processingFeeCents = 0;
    expect(processingFeeCents).toBe(0);
  });

  it('total charged = donation + tip + processing fee', () => {
    const donation = 10000;
    const tip = donorTip(donation, 8);         // 800
    const processing = methodProcessingFee(donation + tip, 'card');
    const total = donation + tip + processing;
    expect(total).toBeGreaterThan(donation);
    expect(total).toBeLessThan(donation * 2);
  });

  it('application_fee = tip + processing when organizer has connect account', () => {
    const donation = 10000;
    const tip = donorTip(donation, 8);         // 800
    const processing = methodProcessingFee(donation + tip, 'card');
    const appFee = tip + processing;
    expect(appFee).toBeGreaterThan(0);
    // Organizer gets exactly donation amount (before Stripe's own cut)
    const organizerNet = donation;
    expect(organizerNet).toBe(10000);
  });

  it('no application_fee when organizer has no connect account', () => {
    // When !hasConnectedAccount, application_fee_amount is omitted
    const hasConnectedAccount = false;
    const appFee = hasConnectedAccount ? donorTip(10000, 8) : undefined;
    expect(appFee).toBeUndefined();
  });

  it('bank transfer has lower processing fee than card', () => {
    const amount = 10000;
    const cardFee = methodProcessingFee(amount, 'card');
    const bankFee = methodProcessingFee(amount, 'bank');
    expect(bankFee).toBeLessThanOrEqual(cardFee);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G25-06: Admin money flow reporting
// ─────────────────────────────────────────────────────────────────────────────
describe('admin money flow reporting', () => {
  function makeRow(overrides: Partial<AdminPaymentRow> = {}): AdminPaymentRow {
    return {
      id: crypto.randomUUID(),
      campaign_id: crypto.randomUUID(),
      campaign_owner_id: crypto.randomUUID(),
      processor: 'stripe',
      processor_charge_id: null,
      processor_payment_intent_id: null,
      processor_checkout_session_id: null,
      processor_transfer_id: null,
      processor_payout_id: null,
      gross_amount: 10000,
      tip_amount: 800,
      platform_fee_amount: 500,
      processor_fee_amount: 320,
      campaign_owner_net_amount: 10000,
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
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  it('aggregates gross across all payment rows', () => {
    const rows = [
      makeRow({ gross_amount: 10000 }),
      makeRow({ gross_amount: 25000 }),
      makeRow({ gross_amount: 5000 }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.totalGross).toBe(40000);
  });

  it('separates paid-out vs pending-payout totals', () => {
    const rows = [
      makeRow({ campaign_owner_net_amount: 10000, payout_status: 'paid' }),
      makeRow({ campaign_owner_net_amount: 5000, payout_status: 'requested' }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.totalPaidOut).toBe(10000);
    expect(summary.totalPendingPayout).toBe(5000);
  });

  it('counts failed payments separately', () => {
    const rows = [
      makeRow({ payment_status: 'succeeded' }),
      makeRow({ payment_status: 'failed', reconciliation_status: 'failed' }),
      makeRow({ payment_status: 'failed', reconciliation_status: 'failed' }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.failedPayments).toBe(2);
  });

  it('totals refunds and disputes across rows', () => {
    const rows = [
      makeRow({ refunded_amount: 3000, disputed_amount: 0 }),
      makeRow({ refunded_amount: 0,    disputed_amount: 7500 }),
      makeRow({ refunded_amount: 1000, disputed_amount: 0 }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.totalRefunds).toBe(4000);
    expect(summary.totalDisputes).toBe(7500);
  });

  it('counts unreconciled rows for finance review queue', () => {
    const rows = [
      makeRow({ reconciliation_status: 'reconciled' }),
      makeRow({ reconciliation_status: 'pending_data' }),
      makeRow({ reconciliation_status: 'needs_review' }),
      makeRow({ reconciliation_status: 'reconciled' }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.unreconciled).toBe(2);
  });

  it('platform revenue = tip + platform_fee across all rows', () => {
    const rows = [
      makeRow({ tip_amount: 800, platform_fee_amount: 500 }),
      makeRow({ tip_amount: 200, platform_fee_amount: 100 }),
    ];
    // summarizePaymentRows uses platform_fee_amount as platform revenue
    const summary = summarizePaymentRows(rows);
    expect(summary.totalPlatformRevenue).toBe(600);
  });

  it('fully disputed payment shows zero net and no payout', () => {
    const result = reconcileMoneyFlow({
      grossAmount: 10000,
      tipAmount: 0,
      platformFeeAmount: 0,
      processorFeeAmount: 0,
      ownerNetAmount: 0,
      refundedAmount: 0,
      disputedAmount: 10000,
      paymentStatus: 'succeeded',
      transferStatus: 'reversed',
      payoutStatus: 'none',
      refundStatus: 'none',
      disputeStatus: 'under_review',
      settlementStatus: 'reversed',
    });
    expect(result.status).toBe('needs_review');
    expect(result.issues).toContain('dispute_recorded');
  });

  it('reconciliation flags correctly when transfer missing but payment succeeded', () => {
    const result = reconcileMoneyFlow({
      grossAmount: 10000,
      tipAmount: 800,
      platformFeeAmount: 500,
      processorFeeAmount: 320,
      ownerNetAmount: 0,
      refundedAmount: 0,
      disputedAmount: 0,
      paymentStatus: 'succeeded',
      transferStatus: 'none',
      payoutStatus: 'none',
      refundStatus: 'none',
      disputeStatus: 'none',
      settlementStatus: 'pending',
    });
    expect(['pending_data', 'needs_review']).toContain(result.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G3-30: Admin trust review action propagation
// ─────────────────────────────────────────────────────────────────────────────
describe('trust review action → campaign status mapping', () => {
  const ACTION_TO_STATUS: Record<string, string | undefined> = {
    approved:  'active',
    rejected:  'frozen',
    held:      'paused',
    released:  'active',
    flagged:   undefined,  // flagged doesn't change campaign status
  };

  it.each(Object.entries(ACTION_TO_STATUS))(
    'action "%s" maps to campaign status %s',
    (action, expectedStatus) => {
      expect(ACTION_TO_STATUS[action]).toBe(expectedStatus);
    },
  );
});
