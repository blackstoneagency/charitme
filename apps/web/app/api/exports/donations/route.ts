import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

function escape(v: unknown): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}

export const dynamic = 'force-dynamic';

// GET /api/exports/donations?year=2026
// Returns a CSV of all completed donations across the user's campaigns.
// Optional `year` query param filters to a specific tax year (Jan 1 – Dec 31).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : null;

  // Fetch user's campaign IDs
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id,title')
    .eq('user_id', user.id);

  const cids = (campaigns ?? []).map((c: { id: string }) => c.id);
  if (cids.length === 0) {
    return new NextResponse('id,campaign,donor_name,amount_usd,status,date\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="donations-${year ?? 'all'}-export.csv"`,
      },
    });
  }

  const campaignMap = new Map((campaigns ?? []).map((c: { id: string; title: string }) => [c.id, c.title]));

  let donationsQuery = supabaseAdmin
    .from('donations')
    .select('id,campaign_id,donor_name,donor_email,amount_cents,status,created_at')
    .in('campaign_id', cids)
    .order('created_at', { ascending: false });

  if (year) {
    donationsQuery = donationsQuery
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lt('created_at',  `${year + 1}-01-01T00:00:00.000Z`);
  }

  const { data: donations } = await donationsQuery;

  type Donation = {
    id: string;
    campaign_id: string;
    donor_name: string | null;
    donor_email: string | null;
    amount_cents: number;
    status: string;
    created_at: string;
  };

  const rows = ((donations ?? []) as Donation[]).map(d => ({
    id: d.id,
    campaign: campaignMap.get(d.campaign_id) ?? '',
    donor_name: d.donor_name ?? '',
    // Note: donor_email intentionally excluded to avoid PII in default export
    amount_usd: (d.amount_cents / 100).toFixed(2),
    status: d.status,
    date: d.created_at,
  }));

  const headers = ['id', 'campaign', 'donor_name', 'amount_usd', 'status', 'date'];
  const body = toCsv(rows, headers);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="donations-${year ?? 'all'}-export.csv"`,
    },
  });
}
