import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { rowsToCsv } from '../../../../lib/csv';
import { formatCents } from '@shared/currencies';
import { getDonorTaxStatement } from '../../../../lib/tax-server';
import { MixedCurrencyError } from '../../../../lib/tax';

export const dynamic = 'force-dynamic';

// GET /api/donor/tax-statement?year=2026&format=json|csv
//
// The authenticated donor's consolidated annual giving statement for a tax
// year: every completed donation they made (across ALL campaigns), with a
// per-donation and total breakdown of tax-deductible vs non-deductible giving.
// Deductible = the campaign is run by a verified nonprofit with tax receipts on.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase();
  if (format !== 'json' && format !== 'csv') {
    return NextResponse.json({ error: 'Unsupported format', code: 'INVALID_FORMAT' }, { status: 400 });
  }
  const yearParam = url.searchParams.get('year');
  const currency = url.searchParams.get('currency')?.trim().toLowerCase() || undefined;
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  let statement, availableYears;
  try {
    ({ statement, availableYears } = await getDonorTaxStatement(user.id, year, currency, user.email));
  } catch (error) {
    if (error instanceof MixedCurrencyError) {
      return NextResponse.json({ error: 'This report contains multiple currencies. Select one currency and try again.', code: error.code, availableCurrencies: error.currencies }, { status: 422 });
    }
    return NextResponse.json({ error: 'Failed to build statement' }, { status: 500 });
  }

  if (format === 'csv') {
    const header = ['Date', 'Receipt #', 'Campaign', 'Organization', 'EIN', 'Amount', 'Tax-Deductible'];
    const rows: (string | number)[][] = statement.lines.map((l) => [
      l.date,
      l.receiptNumber ?? '',
      l.campaignTitle,
      l.organization ?? '',
      l.ein ?? '',
      (l.amountCents / 100).toFixed(2),
      l.deductible ? 'Yes' : 'No',
    ]);
    rows.push([]);
    rows.push(['', '', '', '', 'Total donations', statement.totals.donationCount, '']);
    rows.push(['', '', '', '', 'Total given', (statement.totals.totalGiftCents / 100).toFixed(2), '']);
    rows.push(['', '', '', '', 'Tax-deductible total', (statement.totals.deductibleCents / 100).toFixed(2), '']);
    rows.push(['', '', '', '', 'Non-deductible total', (statement.totals.nonDeductibleCents / 100).toFixed(2), '']);

    const csv = rowsToCsv(header, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="charitme-tax-statement-${year}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({
    statement,
    availableYears,
    formatted: {
      totalGift: formatCents(statement.totals.totalGiftCents, statement.currency),
      deductible: formatCents(statement.totals.deductibleCents, statement.currency),
      nonDeductible: formatCents(statement.totals.nonDeductibleCents, statement.currency),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
