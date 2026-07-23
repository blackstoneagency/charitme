import { describe, expect, it } from 'vitest';
import { buildTaxReportRecords, taxDeductibleByCurrency, taxSummaryLabel, type TaxReportRecord } from '../lib/tax-report';

const record = (overrides: Partial<TaxReportRecord> = {}): TaxReportRecord => ({
  tax_year: 2026,
  receipt_number: 'CHM-1',
  donation_date: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  campaign_title: 'Community project',
  recipient_name: 'Example Foundation',
  recipient_ein: '12-3456789',
  amount_cents: 5000,
  tip_cents: 400,
  processing_fee_cents: 0,
  tax_deductible_amount_cents: 5000,
  currency: 'usd',
  status: 'issued',
  ...overrides,
});

describe('tax report summaries', () => {
  it('builds a record for every completed or refunded donation', () => {
    const records = buildTaxReportRecords([
      {
        id: 'donation-1', amount_cents: 5000, tip_cents: 400, processing_fee_cents: 0,
        currency: 'usd', status: 'completed', created_at: '2026-01-01T00:00:00.000Z', campaign_id: 'campaign-1',
        campaigns: { title: 'Verified campaign', nonprofit_verified: true },
      },
      {
        id: 'donation-2', amount_cents: 2500, tip_cents: 0, processing_fee_cents: 0,
        currency: 'usd', status: 'refunded', created_at: '2026-02-01T00:00:00.000Z', campaign_id: 'campaign-2',
        campaigns: { title: 'Personal campaign', nonprofit_verified: false },
      },
    ], [{ donation_id: 'donation-1', receipt_number: 'CHM-VERIFIED' }]);

    expect(records).toHaveLength(2);
    expect(records[0]?.receipt_number).toBe('CHM-VERIFIED');
    expect(records[0]?.tax_deductible_amount_cents).toBe(5000);
    expect(records[1]?.tax_deductible_amount_cents).toBe(0);
  });

  it('aggregates deductible amounts by currency without mixing currencies', () => {
    expect(taxDeductibleByCurrency([
      record(),
      record({ currency: 'usd', tax_deductible_amount_cents: 2500 }),
      record({ currency: 'eur', tax_deductible_amount_cents: 1200 }),
    ])).toEqual({ usd: 7500, eur: 1200 });
  });

  it('excludes non-deductible records from the summary label', () => {
    expect(taxSummaryLabel([record({ tax_deductible_amount_cents: 0 })])).toBe('No tax-deductible gifts recorded');
    expect(taxSummaryLabel([record({ tax_deductible_amount_cents: 5000 })])).toContain('$50.00');
  });
});
