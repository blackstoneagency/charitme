import 'server-only';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
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

// GET /api/exports/donors
// Returns a deduplicated CSV of donors across the user's campaigns.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id,title')
    .eq('user_id', user.id);

  const cids = (campaigns ?? []).map((c: { id: string }) => c.id);
  if (cids.length === 0) {
    return new NextResponse('donor_name,total_donated_usd,donations_count,last_donation_date\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="donors-export-${Date.now()}.csv"`,
      },
    });
  }

  const { data: donations } = await supabaseAdmin
    .from('donations')
    .select('donor_name,amount_cents,created_at')
    .in('campaign_id', cids)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  type Donation = {
    donor_name: string | null;
    amount_cents: number;
    created_at: string;
  };

  // Aggregate by donor_name (anonymous donors grouped together)
  const donorMap = new Map<string, { total: number; count: number; lastDate: string }>();
  for (const d of (donations ?? []) as Donation[]) {
    const key = d.donor_name ?? 'Anonymous';
    const existing = donorMap.get(key);
    if (existing) {
      existing.total += d.amount_cents;
      existing.count += 1;
      if (d.created_at > existing.lastDate) existing.lastDate = d.created_at;
    } else {
      donorMap.set(key, { total: d.amount_cents, count: 1, lastDate: d.created_at });
    }
  }

  const rows = Array.from(donorMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, agg]) => ({
      donor_name: name,
      total_donated_usd: (agg.total / 100).toFixed(2),
      donations_count: agg.count,
      last_donation_date: agg.lastDate,
    }));

  const headers = ['donor_name', 'total_donated_usd', 'donations_count', 'last_donation_date'];
  const body = toCsv(rows, headers);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="donors-export-${Date.now()}.csv"`,
    },
  });
}
