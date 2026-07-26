import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { checkRateLimit } from '../../../../../lib/rate-limit';

const Schema = z.object({
  message: z.string().trim().min(1).max(1000),
  anonymous: z.boolean().optional(),
});

const MAX_LIMIT = 50;

type DonorProfile = { full_name?: string | null; avatar_url?: string | null; show_public_profile?: boolean | null };

function asProfile(value: unknown): DonorProfile {
  if (Array.isArray(value)) return (value[0] ?? {}) as DonorProfile;
  return (value ?? {}) as DonorProfile;
}

// GET /api/campaigns/[id]/messages?limit=8&offset=8
// Public endpoint powering "Load more comments" pagination on the campaign
// donor-messages wall.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(`campaign-messages:${ip}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { id: campaignId } = await params;
  const url = new URL(request.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || 8));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  const { data, error } = await supabaseAdmin
    .from('donor_messages')
    .select('id, message, anonymous, created_at, profiles:donor_id(full_name, avatar_url, show_public_profile)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const messages = data ?? [];
  const messageIds = messages.map((m) => m.id);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const likeCounts = new Map<string, number>();
  const likedByUser = new Set<string>();
  const repliesByMessage = new Map<string, { id: string; message: string; created_at: string }[]>();

  if (messageIds.length > 0) {
    const [{ data: likes }, { data: replies }] = await Promise.all([
      supabaseAdmin.from('donor_message_likes').select('donor_message_id, user_id').in('donor_message_id', messageIds),
      supabaseAdmin.from('campaign_owner_replies').select('id, donor_message_id, message, created_at').in('donor_message_id', messageIds).order('created_at', { ascending: true }),
    ]);
    for (const like of (likes ?? []) as { donor_message_id: string; user_id: string }[]) {
      likeCounts.set(like.donor_message_id, (likeCounts.get(like.donor_message_id) ?? 0) + 1);
      if (user && like.user_id === user.id) likedByUser.add(like.donor_message_id);
    }
    for (const r of (replies ?? []) as { id: string; donor_message_id: string | null; message: string; created_at: string }[]) {
      if (!r.donor_message_id) continue;
      const bucket = repliesByMessage.get(r.donor_message_id) ?? [];
      bucket.push({ id: r.id, message: r.message, created_at: r.created_at });
      repliesByMessage.set(r.donor_message_id, bucket);
    }
  }

  const comments = messages.map((m) => {
    const profile = asProfile(m.profiles);
    return {
      id: m.id,
      // Third copy of this mapping (page render + this pagination route + the
      // donation wall). Both gates: the per-message `anonymous` flag and the
      // account-wide Profile Visibility setting.
      name: m.anonymous
        ? 'Anonymous'
        : (profile.show_public_profile ?? true)
          ? (profile.full_name ?? 'Kind supporter')
          : 'Kind supporter',
      avatarUrl: (m.anonymous || !(profile.show_public_profile ?? true))
        ? null
        : (profile.avatar_url ?? null),
      anonymous: m.anonymous,
      message: m.message,
      createdAt: m.created_at,
      likeCount: likeCounts.get(m.id) ?? 0,
      likedByUser: likedByUser.has(m.id),
      replies: (repliesByMessage.get(m.id) ?? []).map((r) => ({ id: r.id, message: r.message, createdAt: r.created_at })),
    };
  });

  return NextResponse.json({ comments, hasMore: comments.length === limit });
}

// POST /api/campaigns/[id]/messages
// Lets a signed-in user leave a public "words of support" comment on a
// campaign — the same donor_messages wall shown in the Comments section.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`donor-message:${user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { id: campaignId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { message, anonymous } = parsed.data;

  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('donor_messages')
    .insert({
      campaign_id: campaignId,
      donor_id: user.id,
      message,
      anonymous: !!anonymous,
    })
    .select('id, message, anonymous, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ comment: data });
}
