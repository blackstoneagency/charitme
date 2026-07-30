import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { checkRateLimit } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Membership tiers — the write half of the creator module.
//
// `membership_tiers` had 0 rows and no reader or writer. A read-only surface
// would have left it that way: tiers can only appear if someone can create one,
// and the seed file that would populate them is fail-closed behind an owner-only
// guard. So this ships with the page that displays them, not before it.
//
// Ownership is resolved from the caller's own `creator_profiles` row rather than
// taken from the request. A `creatorProfileId` in the body would be an IDOR: any
// signed-in user could add tiers to someone else's creator page. The RLS policy
// `membership_tiers_owner_write` would also catch it, but the route should not
// depend on the database to refuse a request it can refuse itself.
// ─────────────────────────────────────────────────────────────────────────────

const TierSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(500),
  amountCents: z.number().int().min(100).max(100_000_00),
  interval: z.enum(['month', 'year']),
  benefits: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
});

/** The caller's creator profile id, or null when they do not have one. */
async function callerCreatorProfileId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('creator_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// GET — the caller's own tiers, including inactive ones (the public page only
// ever shows active; an owner needs to see what they have hidden).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const creatorProfileId = await callerCreatorProfileId(user.id);
  if (!creatorProfileId) return NextResponse.json({ tiers: [], hasCreatorProfile: false });

  const { data, error } = await supabaseAdmin
    .from('membership_tiers')
    .select('id, title, description, amount_cents, interval, benefits, active, created_at')
    .eq('creator_profile_id', creatorProfileId)
    .order('amount_cents', { ascending: true });

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ tiers: data ?? [], hasCreatorProfile: true });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`creator-tier:${user.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = TierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const creatorProfileId = await callerCreatorProfileId(user.id);
  if (!creatorProfileId) {
    // Not a 403: the caller is allowed to do this, they just have no creator
    // page yet. Saying so is more useful than "Forbidden".
    return NextResponse.json(
      { error: 'Create your creator page before adding membership tiers.', code: 'NO_CREATOR_PROFILE' },
      { status: 409 },
    );
  }

  const { title, description, amountCents, interval, benefits } = parsed.data;
  const { data, error } = await supabaseAdmin
    .from('membership_tiers')
    .insert({
      creator_profile_id: creatorProfileId,
      title,
      description,
      amount_cents: amountCents,
      interval,
      benefits,
      active: true,
    })
    .select('id, title, description, amount_cents, interval, benefits, active, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ tier: data }, { status: 201 });
}
