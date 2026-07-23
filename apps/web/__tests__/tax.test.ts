import { describe, expect, it } from 'vitest';
import {
  isDeductible,
  buildTaxStatement,
  donationYears,
  type TaxDonationInput,
  type NonprofitTaxInfo,
} from '../lib/tax';

const verifiedNonprofit: NonprofitTaxInfo = { name: 'Helping Hands Inc', taxId: '12-3456789', verified: true, taxReceiptEnabled: true };
const unverifiedNonprofit: NonprofitTaxInfo = { name: 'Pending Org', taxId: '98-7654321', verified: false, taxReceiptEnabled: true };
const receiptsOffNonprofit: NonprofitTaxInfo = { name: 'No Receipts Org', taxId: '55-5555555', verified: true, taxReceiptEnabled: false };

function don(overrides: Partial<TaxDonationInput>): TaxDonationInput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    amountCents: 10_000,
    tipCents: 0,
    currency: 'usd',
    status: 'completed',
    createdAt: '2026-03-15T12:00:00.000Z',
    campaignId: 'camp-1',
    campaignTitle: 'A Campaign',
    nonprofit: null,
    ...overrides,
  };
}

describe('isDeductible', () => {
  it('true only for a verified, receipt-enabled nonprofit', () => {
    expect(isDeductible(verifiedNonprofit)).toBe(true);
    expect(isDeductible(unverifiedNonprofit)).toBe(false);
    expect(isDeductible(receiptsOffNonprofit)).toBe(false);
    expect(isDeductible(null)).toBe(false);
    expect(isDeductible(undefined)).toBe(false);
  });
});

describe('buildTaxStatement', () => {
  it('filters to completed donations in the requested tax year', () => {
    const donations = [
      don({ id: 'a', createdAt: '2026-01-02T00:00:00Z' }),
      don({ id: 'b', createdAt: '2025-12-31T23:59:59Z' }), // prior year
      don({ id: 'c', createdAt: '2026-06-01T00:00:00Z', status: 'refunded' }), // not completed
      don({ id: 'd', createdAt: '2027-01-01T00:00:00Z' }), // next year
    ];
    const s = buildTaxStatement(donations, 2026);
    expect(s.lines.map((l) => l.id)).toEqual(['a']);
    expect(s.totals.donationCount).toBe(1);
  });

  it('splits deductible vs non-deductible totals correctly', () => {
    const donations = [
      don({ id: 'a', amountCents: 5_000, nonprofit: verifiedNonprofit }),
      don({ id: 'b', amountCents: 3_000, nonprofit: null }), // personal
      don({ id: 'c', amountCents: 2_000, nonprofit: unverifiedNonprofit }), // not deductible
    ];
    const s = buildTaxStatement(donations, 2026);
    expect(s.totals.totalGiftCents).toBe(10_000);
    expect(s.totals.deductibleCents).toBe(5_000);
    expect(s.totals.nonDeductibleCents).toBe(5_000);
  });

  it('excludes tips from gift totals and reports them separately', () => {
    const s = buildTaxStatement([don({ amountCents: 10_000, tipCents: 800, nonprofit: verifiedNonprofit })], 2026);
    expect(s.totals.totalGiftCents).toBe(10_000);
    expect(s.totals.deductibleCents).toBe(10_000);
    expect(s.totals.totalTipCents).toBe(800);
  });

  it('only attaches organization name + EIN to deductible lines', () => {
    const s = buildTaxStatement([
      don({ id: 'a', nonprofit: verifiedNonprofit }),
      don({ id: 'b', nonprofit: unverifiedNonprofit }),
    ], 2026);
    const a = s.lines.find((l) => l.id === 'a')!;
    const b = s.lines.find((l) => l.id === 'b')!;
    expect(a.deductible).toBe(true);
    expect(a.organization).toBe('Helping Hands Inc');
    expect(a.ein).toBe('12-3456789');
    expect(b.deductible).toBe(false);
    expect(b.organization).toBeNull();
    expect(b.ein).toBeNull();
  });

  it('groups deductible giving by organization, descending', () => {
    const other: NonprofitTaxInfo = { name: 'Small Org', taxId: '11-1111111', verified: true, taxReceiptEnabled: true };
    const s = buildTaxStatement([
      don({ id: 'a', amountCents: 4_000, nonprofit: verifiedNonprofit }),
      don({ id: 'b', amountCents: 6_000, nonprofit: verifiedNonprofit }),
      don({ id: 'c', amountCents: 1_000, nonprofit: other }),
      don({ id: 'd', amountCents: 9_000, nonprofit: null }), // excluded from orgs
    ], 2026);
    expect(s.organizations).toEqual([
      { name: 'Helping Hands Inc', ein: '12-3456789', deductibleCents: 10_000 },
      { name: 'Small Org', ein: '11-1111111', deductibleCents: 1_000 },
    ]);
  });

  it('handles an empty statement', () => {
    const s = buildTaxStatement([], 2026);
    expect(s.totals.donationCount).toBe(0);
    expect(s.totals.totalGiftCents).toBe(0);
    expect(s.lines).toEqual([]);
    expect(s.organizations).toEqual([]);
  });

  it('sorts lines newest-first', () => {
    const s = buildTaxStatement([
      don({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
      don({ id: 'new', createdAt: '2026-12-01T00:00:00Z' }),
    ], 2026);
    expect(s.lines.map((l) => l.id)).toEqual(['new', 'old']);
  });
});

describe('donationYears', () => {
  it('returns distinct completed-donation years, descending', () => {
    const years = donationYears([
      don({ createdAt: '2026-01-01T00:00:00Z' }),
      don({ createdAt: '2024-05-01T00:00:00Z' }),
      don({ createdAt: '2026-09-01T00:00:00Z' }),
      don({ createdAt: '2025-01-01T00:00:00Z', status: 'pending' }), // excluded
    ]);
    expect(years).toEqual([2026, 2024]);
  });
});
