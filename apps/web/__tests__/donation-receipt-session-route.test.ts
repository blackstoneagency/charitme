import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { DonationOutcome } from '../lib/donation-outcome-core';

const state = vi.hoisted(() => ({
  allowed: true,
  outcome: null as DonationOutcome | null,
}));

vi.mock('../lib/donation-outcome-server', () => ({
  getDonationOutcome: async () => state.outcome,
}));

vi.mock('../lib/rate-limit-durable', () => ({
  checkRateLimitDurable: async () => state.allowed,
}));

vi.mock('../lib/receipt-template', () => ({
  donationReceiptEmail: (input: { amountFormatted: string }) => ({
    html: `donation:${input.amountFormatted}`,
  }),
  taxReceiptEmail: (input: { amountFormatted: string }) => ({
    html: `tax:${input.amountFormatted}`,
  }),
}));

vi.mock('../lib/stripe', () => ({
  formatCents: (cents: number, currency: string) => `${currency}:${cents}`,
}));

const settled: DonationOutcome = {
  status: 'settled',
  donationId: 'donation-1',
  amountCents: 5000,
  tipCents: 400,
  processingFeeCents: 175,
  currency: 'usd',
  createdAt: '2026-08-08T12:00:00.000Z',
  transactionId: 'pi_abcdefghijkl',
  donorName: 'Donor',
  donorEmail: 'donor@example.com',
  campaignId: 'campaign-1',
  campaignTitle: 'Clean Water',
  campaignSlug: 'clean-water',
  paymentMethodLabel: null,
  receiptNumber: 'TAX-100',
  taxDeductible: true,
  taxReceiptAmountCents: 5000,
  nonprofitName: 'Clean Water Fund',
  nonprofitEin: '12-3456789',
};

function request(sessionId = 'cs_test_abcdefghij'): NextRequest {
  return new NextRequest(`http://localhost/api/donations/receipt/session?session_id=${sessionId}`, {
    headers: { 'x-forwarded-for': '192.0.2.1' },
  });
}

beforeEach(() => {
  vi.resetModules();
  state.allowed = true;
  state.outcome = settled;
});

describe('GET /api/donations/receipt/session', () => {
  it('uses the issued tax-receipt amount, excluding tip and processing fee', async () => {
    const { GET } = await import('../app/api/donations/receipt/session/route');
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('tax:usd:5000');
    expect(response.headers.get('content-disposition')).toContain('attachment');
  });

  it('uses the complete card charge for a non-tax receipt', async () => {
    state.outcome = {
      ...settled,
      taxDeductible: false,
      taxReceiptAmountCents: null,
      nonprofitName: null,
      nonprofitEin: null,
    };
    const { GET } = await import('../app/api/donations/receipt/session/route');
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('donation:usd:5575');
  });

  it('rejects an invalid bearer session before lookup', async () => {
    const { GET } = await import('../app/api/donations/receipt/session/route');
    const response = await GET(request('not-a-session'));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_INPUT');
  });

  it('rate limits guest receipt downloads', async () => {
    state.allowed = false;
    const { GET } = await import('../app/api/donations/receipt/session/route');
    const response = await GET(request());

    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe('RATE_LIMITED');
  });

  it('returns 404 when the verified payment cannot be found', async () => {
    state.outcome = null;
    const { GET } = await import('../app/api/donations/receipt/session/route');
    const response = await GET(request());

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('NOT_FOUND');
  });

  it('returns a retryable 409 while the webhook is still writing the receipt', async () => {
    state.outcome = { ...settled, status: 'pending', donationId: null };
    const { GET } = await import('../app/api/donations/receipt/session/route');
    const response = await GET(request());

    expect(response.status).toBe(409);
    expect(response.headers.get('retry-after')).toBe('5');
    expect((await response.json()).code).toBe('RECEIPT_PENDING');
  });
});
