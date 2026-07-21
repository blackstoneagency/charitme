import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/announcements — public: currently-active, in-window announcements for
// the site-wide banner. Returns only display-safe fields.
export async function GET() {
  const nowIso = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from('announcements')
    .select('id, title, body, level, link_url, link_label, starts_at, ends_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(5);

  const active = (data ?? []).filter((a) => {
    const startsOk = !a.starts_at || (a.starts_at as string) <= nowIso;
    const endsOk = !a.ends_at || (a.ends_at as string) >= nowIso;
    return startsOk && endsOk;
  });

  return NextResponse.json(
    { announcements: active },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
