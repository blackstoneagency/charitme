import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { checkRateLimit } from '../../../../../lib/rate-limit';

const MAX_LIMIT = 50;

type DonorProfile = { full_name?: string | null; avatar_url?: string | null; show_public_profile?: boolean | null };

function asProfile(value: unknown): DonorProfile {
  if (Array.isArray(value)) return (value[0] ?? {}) as DonorProfile;
  return (value ?? {}) as DonorProfile;
}

// ── GET /api/campaigns/[id]/donations ───────────────────────────────────────
// Public endpoint powering the donor wall + live donation ticker.
//
//   ?sort=recent|top   (default recent)
//   ?limit=10          (max 50)
//   ?offset=0          for "load more" pagination
//   ?since=<ISO8601>   only donations created after this time, oldest-first
//                      (used by the ticker to poll for new gifts)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`campaign-donations:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'recent';
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 10));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const since = url.searchParams.get('since');

  // Do not expose the donor wall (names, messages, amounts) for private or
  // deleted campaigns. Public and unlisted campaigns are shown as normal.
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('visibility, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!campaign || campaign.deleted_at || (campaign as { visibility?: string }).visibility === 'private') {
    return NextResponse.json({ donations: [], hasMore: false });
  }

  let query = supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, message, anonymous, created_at, offline_donor_name, profiles:donor_id(full_name, avatar_url, show_public_profile)')
    .eq('campaign_id', id)
    .eq('status', 'completed');

  if (since) {
    query = query.gt('created_at', since).order('created_at', { ascending: true }).limit(limit);
  } else if (sort === 'top') {
    query = query.order('amount_cents', { ascending: false }).range(offset, offset + limit - 1);
  } else {
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const donations = (data ?? []).map((d) => {
    const profile = asProfile(d.profiles);
    const name = d.anonymous
      ? 'Anonymous'
      : (profile.full_name || d.offline_donor_name || 'Kind supporter');
    return {
      id: d.id,
      name,
      avatarUrl: d.anonymous ? null : (profile.avatar_url ?? null),
      amountCents: d.amount_cents,
      message: d.message,
      createdAt: d.created_at,
      anonymous: d.anonymous,
      donorId: d.anonymous ? null : (d.donor_id ?? null),
      showPublicProfile: profile.show_public_profile ?? true,
    };
  });

  return NextResponse.json({ donations, hasMore: !since && donations.length === limit });
}
