import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

function csv(rows: Record<string, unknown>[], headers: string[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id,title,slug,status,raised_amount,goal_amount,backer_count,category,created_at')
    .eq('user_id', user.id)
    .order('raised_amount', { ascending: false });

  const cids = (campaigns ?? []).map((c: { id: string }) => c.id);

  const { data: donations } = cids.length > 0
    ? await supabaseAdmin
        .from('donations')
        .select('campaign_id,amount_cents,status,created_at')
        .in('campaign_id', cids)
        .eq('status', 'completed')
    : { data: [] };

  const donationsByCampaign = new Map<string, number>();
  for (const d of (donations ?? []) as { campaign_id: string; amount_cents: number }[]) {
    donationsByCampaign.set(d.campaign_id, (donationsByCampaign.get(d.campaign_id) ?? 0) + 1);
  }

  type Campaign = { id: string; title: string; slug: string; status: string; raised_amount: number; goal_amount: number; backer_count: number; category: string | null; created_at: string };

  const rows = ((campaigns ?? []) as Campaign[]).map(c => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    status: c.status,
    raised_usd: (c.raised_amount / 100).toFixed(2),
    goal_usd: (c.goal_amount / 100).toFixed(2),
    pct_funded: c.goal_amount > 0 ? ((c.raised_amount / c.goal_amount) * 100).toFixed(1) + '%' : '0%',
    backers: c.backer_count,
    donations_count: donationsByCampaign.get(c.id) ?? 0,
    category: c.category ?? '',
    created_at: c.created_at,
  }));

  const headers = ['id', 'title', 'slug', 'status', 'raised_usd', 'goal_usd', 'pct_funded', 'backers', 'donations_count', 'category', 'created_at'];
  const body = csv(rows, headers);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="analytics-export-${Date.now()}.csv"`,
    },
  });
}
