import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Creator posts — the author side of `exclusive_posts`.
//
// The table had a schema, two RLS policies and neither a reader nor a writer.
// This is the writer; `/creators/[handle]` is the reader.
//
// ⚠️ This route deliberately does NOT serve posts to readers. It returns the
// caller's OWN posts, unredacted, because they wrote them. Public reading goes
// through the creator page, which redacts via `lib/creator-posts`. Keeping the
// two apart means there is exactly one path that can leak a locked body, and it
// is the one with the tests on it — rather than a general-purpose endpoint that
// has to remember to redact depending on who is asking.
//
// Ownership is derived from the session, never from the body: `author_id` is
// the caller and `creator_profile_id` is looked up from their own profile. A
// `creatorProfileId` parameter would let any signed-in user post to someone
// else's page.
// ─────────────────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  title: z.string().trim().min(2).max(140),
  body: z.string().trim().min(2).max(20_000),
  visibility: z.enum(['public', 'members', 'tier']).default('public'),
  minimumTierId: z.string().uuid().nullable().optional(),
});

const SELECT = 'id, title, body, visibility, minimum_tier_id, created_at';

async function callerCreatorProfileId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('creator_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * A tier id supplied by the caller must belong to the caller's own creator
 * profile. Otherwise a post could be gated behind someone else's tier, which
 * would either be unsatisfiable or would leak across creators depending on how
 * the reader resolves prices.
 */
async function ownsTier(creatorProfileId: string, tierId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('membership_tiers')
    .select('id')
    .eq('id', tierId)
    .eq('creator_profile_id', creatorProfileId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('exclusive_posts')
    .select(SELECT)
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`creator-post:${user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const creatorProfileId = await callerCreatorProfileId(user.id);
  if (!creatorProfileId) {
    return NextResponse.json(
      { error: 'Create your creator page before posting.', code: 'NO_CREATOR_PROFILE' },
      { status: 409 },
    );
  }

  const { title, body: postBody, visibility } = parsed.data;
  const minimumTierId = parsed.data.minimumTierId ?? null;

  if (visibility === 'tier') {
    if (!minimumTierId) {
      return NextResponse.json({ error: 'Choose the tier this post requires.' }, { status: 400 });
    }
    if (!(await ownsTier(creatorProfileId, minimumTierId))) {
      return NextResponse.json({ error: 'That tier does not belong to your creator page.' }, { status: 400 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('exclusive_posts')
    .insert({
      creator_profile_id: creatorProfileId,
      author_id: user.id,
      title,
      body: postBody,
      visibility,
      // Cleared unless the post is actually tier-gated, so a leftover id from a
      // changed selection cannot silently re-gate the post later.
      minimum_tier_id: visibility === 'tier' ? minimumTierId : null,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ post: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Ownership is a filter inside the DELETE rather than a prior read: a
  // check-then-delete leaves a window, and someone else's post simply matches
  // no row.
  const { data, error } = await supabaseAdmin
    .from('exclusive_posts')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
