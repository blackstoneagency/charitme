import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { toCsv } from '../../../../lib/csv';

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

  // The donations table has no donor_name/donor_email columns — donor identity is
  // either a registered user (donor_id → profiles.full_name), an offline donor
  // (offline_donor_name), or anonymous.
  let donationsQuery = supabaseAdmin
    .from('donations')
    .select('id,campaign_id,donor_id,offline_donor_name,anonymous,amount_cents,status,created_at')
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
    donor_id: string | null;
    offline_donor_name: string | null;
    anonymous: boolean | null;
    amount_cents: number;
    status: string;
    created_at: string;
  };

  const dons = (donations ?? []) as Donation[];

  // Resolve registered donor display names in one batched lookup.
  const donorIds = [...new Set(dons.map(d => d.donor_id).filter((v): v is string => !!v))];
  const nameMap = new Map<string, string>();
  if (donorIds.length > 0) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id,full_name').in('id', donorIds);
    for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
      nameMap.set(p.id, p.full_name ?? '');
    }
  }
  const donorName = (d: Donation): string =>
    d.anonymous ? 'Anonymous' : (d.offline_donor_name || (d.donor_id ? nameMap.get(d.donor_id) ?? '' : '') || '');

  const rows = dons.map(d => ({
    id: d.id,
    campaign: campaignMap.get(d.campaign_id) ?? '',
    donor_name: donorName(d),
    // Note: donor email intentionally excluded to avoid PII in default export
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
