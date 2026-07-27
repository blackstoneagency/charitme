import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const taxCenter = readFileSync(
  join(__dirname, '..', 'app', 'dashboard', 'tax', 'page.tsx'),
  'utf8',
);
const fundraiserStatement = readFileSync(
  join(__dirname, '..', 'app', 'dashboard', 'tax', 'fundraiser', '[year]', 'page.tsx'),
  'utf8',
);

describe('tax document center', () => {
  it('offers donor and campaign documents in printable and CSV formats', () => {
    expect(taxCenter).toContain('Donor documents');
    expect(taxCenter).toContain('Campaign records');
    expect(taxCenter).toContain('View / save PDF');
    expect(taxCenter).toContain('/api/donor/tax-statement?');
    expect(taxCenter).toContain('/api/fundraiser/tax-summary?');
  });

  it('keeps currency in every generated document URL', () => {
    expect(taxCenter).toContain('encodeURIComponent(currency)');
    expect(fundraiserStatement).toContain('currency=${encodeURIComponent(summary.currency)}');
  });

  it('provides donor receipt re-delivery from the same workspace', () => {
    expect(taxCenter).toContain('<ReceiptButton donationId={line.id} />');
    expect(taxCenter).toContain('Re-send any completed donation receipt');
  });

  it('includes filing limitations on the organizer summary', () => {
    expect(fundraiserStatement).toContain('not a tax form or tax advice');
    expect(fundraiserStatement).toContain('Refunded, failed, and pending donations are excluded');
  });
});
