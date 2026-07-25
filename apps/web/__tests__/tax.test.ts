import { describe, expect, it } from 'vitest';
import {
  isDeductible,
  canIssueTaxReceipt,
  buildTaxStatement,
  buildFundraiserTaxSummary,
  donationYears,
  type TaxDonationInput,
  type NonprofitTaxInfo,
  type FundraiserDonationInput,
  MixedCurrencyError,
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

describe('canIssueTaxReceipt', () => {
  it('requires deductibility AND a non-empty EIN', () => {
    expect(canIssueTaxReceipt(verifiedNonprofit)).toBe(true);
    // deductible but no EIN on file → cannot email an official receipt
    expect(canIssueTaxReceipt({ ...verifiedNonprofit, taxId: null })).toBe(false);
    expect(canIssueTaxReceipt({ ...verifiedNonprofit, taxId: '   ' })).toBe(false);
    // has EIN but not verified / receipts off → not deductible at all
    expect(canIssueTaxReceipt(unverifiedNonprofit)).toBe(false);
    expect(canIssueTaxReceipt(receiptsOffNonprofit)).toBe(false);
    expect(canIssueTaxReceipt(null)).toBe(false);
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

  it('does not invent an official receipt number', () => {
    const s = buildTaxStatement([don({ id: 'unreceipted', receiptNumber: null })], 2026);
    expect(s.lines[0]?.receiptNumber).toBeNull();
  });

  it('rejects mixed currencies instead of adding incompatible cents', () => {
    expect(() => buildTaxStatement([
      don({ currency: 'usd' }),
      don({ id: 'eur-gift', currency: 'eur' }),
    ], 2026)).toThrowError(MixedCurrencyError);
    try {
      buildTaxStatement([don({ currency: 'usd' }), don({ id: 'eur-gift', currency: 'eur' })], 2026);
    } catch (error) {
      expect(error).toMatchObject({ currencies: ['eur', 'usd'] });
    }
  });
});

describe('buildFundraiserTaxSummary', () => {
  function fdon(o: Partial<FundraiserDonationInput>): FundraiserDonationInput {
    return {
      amountCents: 10_000, tipCents: 0, currency: 'usd', status: 'completed',
      createdAt: '2026-04-01T00:00:00Z', campaignId: 'c1', campaignTitle: 'Camp 1', ...o,
    };
  }

  it('groups gross + count by campaign for the year, excludes tips from gross', () => {
    const s = buildFundraiserTaxSummary([
      fdon({ campaignId: 'c1', campaignTitle: 'Camp 1', amountCents: 5_000, tipCents: 500 }),
      fdon({ campaignId: 'c1', campaignTitle: 'Camp 1', amountCents: 3_000, tipCents: 300 }),
      fdon({ campaignId: 'c2', campaignTitle: 'Camp 2', amountCents: 9_000 }),
      fdon({ campaignId: 'c2', campaignTitle: 'Camp 2', amountCents: 1_000, status: 'refunded' }), // excluded
      fdon({ campaignId: 'c1', campaignTitle: 'Camp 1', amountCents: 999, createdAt: '2025-12-31T00:00:00Z' }), // prior year
    ], 2026);
    // Sorted by gross desc: c1 (8000) then c2 (9000)? c2 gross 9000 > c1 8000 → c2 first
    expect(s.campaigns.map((c) => c.campaignId)).toEqual(['c2', 'c1']);
    const c1 = s.campaigns.find((c) => c.campaignId === 'c1')!;
    expect(c1.donationCount).toBe(2);
    expect(c1.grossCents).toBe(8_000);
    expect(c1.tipCents).toBe(800);
    expect(s.totals.grossCents).toBe(17_000);
    expect(s.totals.donationCount).toBe(3);
    expect(s.totals.tipCents).toBe(800);
  });

  it('returns empty totals when no donations match', () => {
    const s = buildFundraiserTaxSummary([], 2026);
    expect(s.campaigns).toEqual([]);
    expect(s.totals).toEqual({ donationCount: 0, grossCents: 0, tipCents: 0 });
  });

  it('rejects mixed currencies instead of adding incompatible cents', () => {
    expect(() => buildFundraiserTaxSummary([
      fdon({ currency: 'usd' }),
      fdon({ currency: 'eur' }),
    ], 2026)).toThrowError(MixedCurrencyError);
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
