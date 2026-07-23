import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { rowsToCsv } from '../../../../lib/csv';
import { formatCents } from '@shared/currencies';
import { buildFundraiserTaxSummary, type FundraiserDonationInput } from '../../../../lib/tax';

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
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  // Campaigns owned by this user.
  const { data: camps, error: campaignsError } = await supabaseAdmin
    .from('campaigns')
    .select('id, title')
    .eq('user_id', user.id);
  if (campaignsError) return NextResponse.json({ error: 'Tax data unavailable', code: 'TAX_DATA_UNAVAILABLE' }, { status: 503 });
  const campaigns = (camps ?? []) as { id: string; title: string }[];
  const titleById = new Map(campaigns.map((c) => [c.id, c.title]));
  const cids = campaigns.map((c) => c.id);

  let inputs: FundraiserDonationInput[] = [];
  if (cids.length > 0) {
    const { data: donations, error: donationsError } = await supabaseAdmin
      .from('donations')
      .select('amount_cents, tip_cents, currency, status, created_at, campaign_id')
      .in('campaign_id', cids)
      .eq('status', 'completed')
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lt('created_at', `${year + 1}-01-01T00:00:00.000Z`);
    if (donationsError) return NextResponse.json({ error: 'Tax data unavailable', code: 'TAX_DATA_UNAVAILABLE' }, { status: 503 });

    inputs = ((donations ?? []) as {
      amount_cents: number; tip_cents: number | null; currency: string | null;
      status: string; created_at: string; campaign_id: string;
    }[]).map((d) => ({
      amountCents: d.amount_cents,
      tipCents: d.tip_cents ?? 0,
      currency: d.currency,
      status: d.status,
      createdAt: d.created_at,
      campaignId: d.campaign_id,
      campaignTitle: titleById.get(d.campaign_id) ?? 'Campaign',
    }));
  }

  const summary = buildFundraiserTaxSummary(inputs, year);

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
    formatted: {
      gross: formatCents(summary.totals.grossCents, summary.currency),
      tips: formatCents(summary.totals.tipCents, summary.currency),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
