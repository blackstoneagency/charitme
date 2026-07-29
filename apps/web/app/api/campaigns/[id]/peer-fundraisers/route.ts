import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Peer-to-peer fundraising: a supporter runs their own page toward someone else's
// campaign goal. The read path shipped first (the Fundraising team section on the
// campaign page) against 240 seeded rows — but there was no way to CREATE one, so
// the feature could only ever display data that arrived by other means.

const Schema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  goalAmount: z.number().int().positive().max(100_000_000).optional(),
});

// Goals are stored in cents, like every other amount in this schema.
const DEFAULT_GOAL_CENTS = 50_000;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// POST /api/campaigns/[id]/peer-fundraisers — join a campaign's fundraising team.
//
// Idempotent per (campaign, user), following /api/grants/[id]/apply: a supporter
// who already has a page for this campaign gets it back rather than a second one.
// `peer_fundraisers.slug` is UNIQUE platform-wide, so a blind insert would also
// 500 on collision for two people with the same display name.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const campaignQuery = supabaseAdmin
    .from('campaigns')
    .select('id, title, user_id, status, visibility')
    .is('deleted_at', null)
    .eq('status', 'active')
    .eq('visibility', 'public');
  const { data: campaign } = await (UUID_RE.test(id)
    ? campaignQuery.eq('id', id)
    : campaignQuery.eq('slug', id)
  ).maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found or not accepting team fundraisers' }, { status: 404 });
  }

  // The organizer already owns the campaign page; a peer page for themselves would
  // split their own total across two goals and double-count them in the team list.
  if (campaign.user_id === user.id) {
    return NextResponse.json(
      { error: 'You already run this campaign — team pages are for supporters raising alongside you.' },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('peer_fundraisers')
    .select('id, slug, title, goal_amount, raised_amount, status')
    .eq('parent_campaign_id', campaign.id)
    .eq('fundraiser_id', user.id)
    .maybeSingle();

  // supabase-js resolves rather than throws, so an unchecked error here would look
  // like "no existing page" and create a duplicate the unique slug then rejects.
  if (existingError) {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
  if (existing) return NextResponse.json({ peerFundraiser: existing, resumed: true });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.trim() || 'Supporter';
  const title = parsed.data.title ?? `${displayName}'s page for ${campaign.title}`;
  const goalAmount = parsed.data.goalAmount ?? DEFAULT_GOAL_CENTS;

  // Slug is UNIQUE across the whole table, so a name-derived slug collides between
  // two supporters with the same name. Retry with a suffix rather than surfacing a
  // 500 that reads to the supporter as "joining is broken".
  const base = slugify(displayName) || 'supporter';
  let created = null;
  let lastError: { code?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const { data, error } = await supabaseAdmin
      .from('peer_fundraisers')
      .insert({
        parent_campaign_id: campaign.id,
        fundraiser_id: user.id,
        slug: `${base}-${suffix}`,
        title,
        goal_amount: goalAmount,
        status: 'active',
      })
      .select('id, slug, title, goal_amount, raised_amount, status')
      .single();

    if (!error) { created = data; break; }
    lastError = error;
    // 23505 = unique_violation. Anything else will not be fixed by retrying.
    if (error.code !== '23505') break;
  }

  if (!created) {
    console.error('[peer-fundraisers] insert failed', { code: lastError?.code });
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ peerFundraiser: created, resumed: false }, { status: 201 });
}
