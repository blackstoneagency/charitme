import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { rowsToCsv } from '../../../../lib/csv';
import { formatCents } from '@shared/currencies';
import { MixedCurrencyError } from '../../../../lib/tax';
import { getFundraiserTaxSummary } from '../../../../lib/tax-server';

export const dynamic = 'force-dynamic';

// GET /api/fundraiser/tax-summary?year=2026&format=json|csv
//
// Year-end fundraising summary for the authenticated campaign owner: gross
// raised + donation count (and tips, separately) per campaign they own, for the
// given tax year. Gross is authoritative; Stripe processing fees are deducted
// and reported separately by Stripe and are not estimated here.
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

  let summary, availableYears;
  try {
    ({ summary, availableYears } = await getFundraiserTaxSummary(user.id, year, currency));
  } catch (error) {
    if (error instanceof MixedCurrencyError) {
      return NextResponse.json({ error: 'This report contains multiple currencies. Select one currency and try again.', code: error.code, availableCurrencies: error.currencies }, { status: 422 });
    }
    return NextResponse.json({ error: 'Tax data unavailable', code: 'TAX_DATA_UNAVAILABLE' }, { status: 503 });
  }

  if (format === 'csv') {
    const header = ['Campaign', 'Donations', 'Gross Raised', 'Donor Tips'];
    const rows: (string | number)[][] = summary.campaigns.map((c) => [
      c.campaignTitle,
      c.donationCount,
      (c.grossCents / 100).toFixed(2),
      (c.tipCents / 100).toFixed(2),
    ]);
    rows.push([]);
    rows.push(['TOTAL', summary.totals.donationCount, (summary.totals.grossCents / 100).toFixed(2), (summary.totals.tipCents / 100).toFixed(2)]);
    const csv = rowsToCsv(header, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="charitme-fundraising-summary-${year}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({
    summary,
    availableYears,
    formatted: {
      gross: formatCents(summary.totals.grossCents, summary.currency),
      tips: formatCents(summary.totals.tipCents, summary.currency),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
