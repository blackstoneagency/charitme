import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// GET /api/donor/donations?offset=0&limit=50
// Paginated donation history for the signed-in donor.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Math.floor(Number(searchParams.get('offset') ?? '0')) || 0);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(searchParams.get('limit') ?? String(PAGE_SIZE))) || PAGE_SIZE));

  const { data: donationData, count } = await supabaseAdmin
    .from('donations')
    .select('id, amount_cents, tip_cents, currency, status, anonymous, message, created_at, campaign_id', { count: 'exact' })
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const donations = donationData ?? [];

  const cids = [...new Set(donations.map((d) => d.campaign_id))].filter(Boolean);
  const campaigns: Record<string, { id: string; title: string; slug: string; cover_image_url: string | null }> = {};
  if (cids.length > 0) {
    const { data: camps } = await supabaseAdmin
      .from('campaigns')
      .select('id, title, slug, cover_image_url')
      .in('id', cids);
    for (const c of (camps ?? []) as { id: string; title: string; slug: string; cover_image_url: string | null }[]) {
      campaigns[c.id] = c;
    }
  }

  const hasMore = (count ?? 0) > offset + donations.length;

  return NextResponse.json({ donations, campaigns, hasMore, total: count ?? 0 });
}
