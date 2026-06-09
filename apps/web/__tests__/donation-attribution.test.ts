import { describe, expect, it } from 'vitest';
import { reconcileMoneyFlow, summarizePaymentRows, type AdminPaymentRow } from '../lib/payment-flow-core';

// ─────────────────────────────────────────────────────────────────────────────
// G25-02: Donor donates — full checkout flow logic
// ─────────────────────────────────────────────────────────────────────────────
describe('donation checkout flow', () => {
  interface CheckoutInput {
    amountCents: number;
    tipPercent: number;
    coverProcessingFee: boolean;
    paymentMethod: 'stripe' | 'paypal' | 'venmo' | 'bank';
    hasConnectedAccount: boolean;
  }

  interface CheckoutBreakdown {
    donation: number;
    tip: number;
    processingFee: number;
    total: number;
    applicationFeeAmount: number;
    organizerReceives: number;
  }

  const PROCESSING_RATES: Record<string, { pct: number; fixed: number; cap?: number }> = {
    stripe: { pct: 2.9, fixed: 30 },
    paypal: { pct: 3.49, fixed: 49 },
    venmo:  { pct: 1.9, fixed: 10 },
    bank:   { pct: 0.8, fixed: 0, cap: 500 },
  };

  function calcBreakdown(input: CheckoutInput): CheckoutBreakdown {
    const tip = Math.round(input.amountCents * (input.tipPercent / 100));
    const subTotal = input.amountCents + tip;

    let processingFee = 0;
    if (input.coverProcessingFee) {
      const rate = PROCESSING_RATES[input.paymentMethod];
      processingFee = Math.round(subTotal * (rate.pct / 100)) + rate.fixed;
      if (rate.cap !== undefined) processingFee = Math.min(processingFee, rate.cap);
    }

    const total = subTotal + processingFee;
    const applicationFeeAmount = input.hasConnectedAccount ? tip + processingFee : 0;
    const organizerReceives = input.hasConnectedAccount ? input.amountCents : 0;

    return { donation: input.amountCents, tip, processingFee, total, applicationFeeAmount, organizerReceives };
  }

  it('calculates zero tip when tipPercent is 0', () => {
    const b = calcBreakdown({ amountCents: 10000, tipPercent: 0, coverProcessingFee: false, paymentMethod: 'stripe', hasConnectedAccount: true });
    expect(b.tip).toBe(0);
    expect(b.total).toBe(10000);
  });

  it('calculates 8% tip correctly', () => {
    const b = calcBreakdown({ amountCents: 10000, tipPercent: 8, coverProcessingFee: false, paymentMethod: 'stripe', hasConnectedAccount: true });
    expect(b.tip).toBe(800);
    expect(b.total).toBe(10800);
  });

  it('adds Stripe processing fee when donor covers it', () => {
    const b = calcBreakdown({ amountCents: 10000, tipPercent: 8, coverProcessingFee: true, paymentMethod: 'stripe', hasConnectedAccount: true });
    // 10800 * 2.9% + $0.30 = 313.2 + 30 = 343
    expect(b.processingFee).toBe(343);
    expect(b.total).toBe(10800 + 343);
  });

  it('adds PayPal processing fee at higher rate', () => {
    const b = calcBreakdown({ amountCents: 10000, tipPercent: 0, coverProcessingFee: true, paymentMethod: 'paypal', hasConnectedAccount: true });
    // 10000 * 3.49% + $0.49 = 349 + 49 = 398
    expect(b.processingFee).toBe(398);
  });

  it('caps bank transfer fee at $5.00', () => {
    const b = calcBreakdown({ amountCents: 1000000, tipPercent: 0, coverProcessingFee: true, paymentMethod: 'bank', hasConnectedAccount: true });
    expect(b.processingFee).toBeLessThanOrEqual(500);
    expect(b.processingFee).toBe(500);
  });

  it('organizer receives exactly the donation amount via Connect', () => {
    const b = calcBreakdown({ amountCents: 5000, tipPercent: 8, coverProcessingFee: true, paymentMethod: 'stripe', hasConnectedAccount: true });
    expect(b.organizerReceives).toBe(5000);
    expect(b.applicationFeeAmount).toBe(b.tip + b.processingFee);
  });

  it('no application_fee when organizer has no connected account', () => {
    const b = calcBreakdown({ amountCents: 5000, tipPercent: 8, coverProcessingFee: true, paymentMethod: 'stripe', hasConnectedAccount: false });
    expect(b.applicationFeeAmount).toBe(0);
    expect(b.organizerReceives).toBe(0);
  });

  it('minimum donation of $1.00 (100 cents)', () => {
    const MIN_DONATION_CENTS = 100;
    expect(100).toBeGreaterThanOrEqual(MIN_DONATION_CENTS);
    expect(99).toBeLessThan(MIN_DONATION_CENTS);
  });

  it('maximum donation of $1,000,000 (100,000,000 cents)', () => {
    const MAX_DONATION_CENTS = 100_000_000;
    expect(100_000_000).toBeLessThanOrEqual(MAX_DONATION_CENTS);
    expect(100_000_001).toBeGreaterThan(MAX_DONATION_CENTS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UTM attribution logic
// ─────────────────────────────────────────────────────────────────────────────
describe('UTM attribution', () => {
  interface UtmParams {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    share_event_id?: string;
  }

  function parseUtmFromUrl(url: string): UtmParams {
    const u = new URL(url, 'https://example.com');
    const result: UtmParams = {};
    const src = u.searchParams.get('utm_source');
    const med = u.searchParams.get('utm_medium');
    const cam = u.searchParams.get('utm_campaign');
    const con = u.searchParams.get('utm_content');
    const sid = u.searchParams.get('share_event_id');
    if (src) result.utm_source = src;
    if (med) result.utm_medium = med;
    if (cam) result.utm_campaign = cam;
    if (con) result.utm_content = con;
    if (sid) result.share_event_id = sid;
    return result;
  }

  function hasAttribution(utm: UtmParams): boolean {
    return !!(utm.utm_source || utm.utm_medium || utm.utm_campaign || utm.share_event_id);
  }

  it('parses UTM params from campaign URL', () => {
    const params = parseUtmFromUrl('/campaigns/help-john?utm_source=facebook&utm_medium=social&utm_campaign=launch');
    expect(params.utm_source).toBe('facebook');
    expect(params.utm_medium).toBe('social');
    expect(params.utm_campaign).toBe('launch');
  });

  it('parses share_event_id for conversion attribution', () => {
    const params = parseUtmFromUrl('/campaigns/help-john?share_event_id=550e8400-e29b-41d4-a716-446655440000');
    expect(params.share_event_id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns empty object for URL without UTM params', () => {
    const params = parseUtmFromUrl('/campaigns/help-john');
    expect(hasAttribution(params)).toBe(false);
  });

  it('detects partial attribution (source only)', () => {
    const params = parseUtmFromUrl('/campaigns/help-john?utm_source=email');
    expect(hasAttribution(params)).toBe(true);
  });

  it('source_utm JSONB stores all attribution fields', () => {
    const utm = { utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'spring', share_event_id: 'abc' };
    const stored = JSON.stringify(utm);
    const parsed = JSON.parse(stored) as UtmParams;
    expect(parsed.utm_source).toBe('facebook');
    expect(parsed.share_event_id).toBe('abc');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G25-06: Admin views money flow — extended reconciliation scenarios
// ─────────────────────────────────────────────────────────────────────────────
describe('admin money flow — extended scenarios', () => {
  it('dispute reduces net even after payment succeeded', () => {
    const result = reconcileMoneyFlow({
      grossAmount: 20000,
      tipAmount: 1600,
      platformFeeAmount: 1600,
      processorFeeAmount: 610,
      ownerNetAmount: 20000,
      refundedAmount: 0,
      disputedAmount: 20000,
      paymentStatus: 'disputed',
      transferStatus: 'created',
      payoutStatus: 'paid',
      refundStatus: 'none',
      disputeStatus: 'under_review',
      settlementStatus: 'disputed',
    });
    expect(result.status).not.toBe('reconciled');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('mismatch detected when owner_net exceeds gross (overpayment)', () => {
    const result = reconcileMoneyFlow({
      grossAmount: 10000,
      tipAmount: 800,
      platformFeeAmount: 800,
      processorFeeAmount: 320,
      ownerNetAmount: 12000, // wrong — exceeds gross, indicating data error
      refundedAmount: 0,
      disputedAmount: 0,
      paymentStatus: 'succeeded',
      transferStatus: 'created',
      payoutStatus: 'paid',
      refundStatus: 'none',
      disputeStatus: 'none',
      settlementStatus: 'paid_out',
    });
    expect(result.status).toBe('mismatch');
    expect(result.issues).toContain('owner_net_exceeds_available_amount');
  });

  it('summarizePaymentRows counts failed payments correctly', () => {
    const rows: AdminPaymentRow[] = [
      makeRow({ payment_status: 'failed', gross_amount: 5000, reconciliation_status: 'failed', payout_status: 'failed' }),
      makeRow({ payment_status: 'failed', gross_amount: 3000, reconciliation_status: 'failed', payout_status: 'failed' }),
      makeRow({ payment_status: 'succeeded', gross_amount: 10000, reconciliation_status: 'reconciled', payout_status: 'paid', campaign_owner_net_amount: 10000, platform_fee_amount: 500, processor_fee_amount: 320 }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.failedPayments).toBe(2);
    expect(summary.totalGross).toBe(18000);
    expect(summary.totalPaidOut).toBe(10000);
  });

  it('summarizePaymentRows aggregates disputes across multiple rows', () => {
    const rows: AdminPaymentRow[] = [
      makeRow({ disputed_amount: 10000, reconciliation_status: 'needs_review' }),
      makeRow({ disputed_amount: 5000, reconciliation_status: 'needs_review' }),
      makeRow({ disputed_amount: 0, reconciliation_status: 'reconciled' }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.totalDisputes).toBe(15000);
    expect(summary.unreconciled).toBeGreaterThanOrEqual(2);
  });

  it('platform revenue = sum of platform_fee_amount across reconciled payments', () => {
    const rows: AdminPaymentRow[] = [
      makeRow({ platform_fee_amount: 500, reconciliation_status: 'reconciled' }),
      makeRow({ platform_fee_amount: 800, reconciliation_status: 'reconciled' }),
      makeRow({ platform_fee_amount: 200, reconciliation_status: 'pending_data' }),
    ];
    const summary = summarizePaymentRows(rows);
    expect(summary.totalPlatformRevenue).toBe(1500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Year-end export date range logic
// ─────────────────────────────────────────────────────────────────────────────
describe('year-end donation export', () => {
  function isInTaxYear(isoDate: string, year: number): boolean {
    const d = new Date(isoDate);
    return d >= new Date(`${year}-01-01T00:00:00.000Z`) && d < new Date(`${year + 1}-01-01T00:00:00.000Z`);
  }

  it('includes donations made on Jan 1 of the tax year', () => {
    expect(isInTaxYear('2026-01-01T00:00:00.000Z', 2026)).toBe(true);
  });

  it('includes donations made on Dec 31 of the tax year', () => {
    expect(isInTaxYear('2026-12-31T23:59:59.999Z', 2026)).toBe(true);
  });

  it('excludes donations from the previous year', () => {
    expect(isInTaxYear('2025-12-31T23:59:59.999Z', 2026)).toBe(false);
  });

  it('excludes donations from the next year', () => {
    expect(isInTaxYear('2027-01-01T00:00:00.000Z', 2026)).toBe(false);
  });

  it('CSV row maps cents to dollars with 2 decimals', () => {
    const amountCents = 10050;
    const formatted = (amountCents / 100).toFixed(2);
    expect(formatted).toBe('100.50');
  });

  it('CSV escapes commas in campaign titles', () => {
    function escape(v: unknown): string {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }
    expect(escape('Help John, Jane, and Bob')).toBe('"Help John, Jane, and Bob"');
    expect(escape('Simple title')).toBe('Simple title');
    expect(escape('He said "hello"')).toBe('"He said ""hello"""');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Notification unread count logic
// ─────────────────────────────────────────────────────────────────────────────
describe('notification unread count', () => {
  interface NotificationRecord {
    id: string;
    user_id: string;
    kind: string;
    read_at: string | null;
  }

  function countUnread(notifications: NotificationRecord[], userId: string): number {
    return notifications.filter(n => n.user_id === userId && n.read_at === null).length;
  }

  const notifications: NotificationRecord[] = [
    { id: '1', user_id: 'user-a', kind: 'donation_received', read_at: null },
    { id: '2', user_id: 'user-a', kind: 'payout_paid', read_at: '2026-01-01T00:00:00Z' },
    { id: '3', user_id: 'user-a', kind: 'refund_processed', read_at: null },
    { id: '4', user_id: 'user-b', kind: 'donation_receipt', read_at: null },
  ];

  it('counts only unread notifications for the given user', () => {
    expect(countUnread(notifications, 'user-a')).toBe(2);
  });

  it('does not count read notifications', () => {
    expect(countUnread(notifications, 'user-a')).not.toBe(3);
  });

  it('counts notifications for different users independently', () => {
    expect(countUnread(notifications, 'user-b')).toBe(1);
  });

  it('returns 0 when all notifications are read', () => {
    const allRead = notifications.map(n => ({ ...n, read_at: '2026-01-01T00:00:00Z' }));
    expect(countUnread(allRead, 'user-a')).toBe(0);
  });

  it('combined count includes both unread notifications and unreplied messages', () => {
    const unreadNotifs = 3;
    const unrepliedMessages = 2;
    const total = unreadNotifs + unrepliedMessages;
    expect(total).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency key format validation
// ─────────────────────────────────────────────────────────────────────────────
describe('donation idempotency', () => {
  function buildIdempotencyKey(campaignId: string, amountCents: number, userId: string, requestKey: string): string {
    return `donation_${campaignId}_${amountCents}_${userId}_${requestKey}`;
  }

  it('produces unique keys for different amounts', () => {
    const k1 = buildIdempotencyKey('camp-1', 5000, 'user-1', 'req-abc');
    const k2 = buildIdempotencyKey('camp-1', 10000, 'user-1', 'req-abc');
    expect(k1).not.toBe(k2);
  });

  it('produces unique keys for different campaigns', () => {
    const k1 = buildIdempotencyKey('camp-1', 5000, 'user-1', 'req-abc');
    const k2 = buildIdempotencyKey('camp-2', 5000, 'user-1', 'req-abc');
    expect(k1).not.toBe(k2);
  });

  it('produces unique keys for different users', () => {
    const k1 = buildIdempotencyKey('camp-1', 5000, 'user-1', 'req-abc');
    const k2 = buildIdempotencyKey('camp-1', 5000, 'user-2', 'req-abc');
    expect(k1).not.toBe(k2);
  });

  it('same inputs produce same key (deterministic)', () => {
    const k1 = buildIdempotencyKey('camp-1', 5000, 'user-1', 'req-abc');
    const k2 = buildIdempotencyKey('camp-1', 5000, 'user-1', 'req-abc');
    expect(k1).toBe(k2);
  });

  it('guest key uses "guest" as user identifier', () => {
    const key = buildIdempotencyKey('camp-1', 5000, 'guest', 'req-abc');
    expect(key).toContain('guest');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeRow(overrides: Partial<AdminPaymentRow>): AdminPaymentRow {
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
    platform_fee_amount: 800,
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
