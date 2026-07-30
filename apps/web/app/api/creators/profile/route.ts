import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { HANDLE_RE, HANDLE_MESSAGE, RESERVED_HANDLES, RESERVED_MESSAGE } from '../../../../lib/creator-handle';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Creator profile — the writer that did not exist.
//
// `/creators/[handle]` reads `creator_profiles` and `/api/creators/tiers` writes
// `membership_tiers`, but nothing could create the profile the second one hangs
// off. The practical effect: POST /api/creators/tiers answered
// `409 NO_CREATOR_PROFILE` for every real user on the platform, because the only
// 350 rows in the table were seeded. The module read as shipped and was
// unreachable.
//
// ⚠️ `handle` is the one field a user cannot freely change, and it is not a
// cosmetic restriction. It is the public URL (`/creators/<handle>`), it is
// UNIQUE at the database level, and it sits in the same namespace as the app's
// own routes — so `/creators/settings` must not become a person. Hence
// RESERVED_HANDLES below and the 409 on conflict.
//
// One profile per user: `creator_profiles_user_id_unique` enforces it, so this
// is an upsert on `user_id` rather than a create-or-error. A second POST edits
// the existing row instead of failing, which is what the form on
// /dashboard/creator needs and what the unique index would force anyway.
// ─────────────────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE_RE, HANDLE_MESSAGE)
    .refine((h) => !RESERVED_HANDLES.has(h), RESERVED_MESSAGE),
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1000).optional().or(z.literal('')),
  heroImageUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  websiteUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Brand colour must be a hex value like #059669.')
    .optional()
    .or(z.literal('')),
  acceptsTips: z.boolean().default(true),
  acceptsCommissions: z.boolean().default(false),
});

const SELECT =
  'id, handle, display_name, bio, hero_image_url, website_url, brand_color, accepts_tips, accepts_commissions, created_at';

/** GET — the caller's own creator profile, or `{ profile: null }` when they have none. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('creator_profiles')
    .select(SELECT)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ profile: data ?? null });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(`creator-profile:${user.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const p = parsed.data;

  // Check the handle against OTHER users before writing. The unique index is the
  // real guarantee — this is here so the caller gets "that handle is taken"
  // instead of a 500, and so the message names the actual problem.
  const { data: clash } = await supabaseAdmin
    .from('creator_profiles')
    .select('user_id')
    .eq('handle', p.handle)
    .maybeSingle();
  if (clash && (clash as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'That handle is already taken.', code: 'HANDLE_TAKEN' }, { status: 409 });
  }

  // Empty strings are stored as NULL, not "". The page renders `bio &&` and
  // `website_url &&`, so an empty string would pass those checks and print an
  // empty paragraph or an anchor with no text.
  const orNull = (v: string | undefined) => (v && v.length > 0 ? v : null);

  const { data, error } = await supabaseAdmin
    .from('creator_profiles')
    .upsert(
      {
        user_id: user.id,
        handle: p.handle,
        display_name: p.displayName,
        bio: orNull(p.bio),
        hero_image_url: orNull(p.heroImageUrl),
        website_url: orNull(p.websiteUrl),
        brand_color: orNull(p.brandColor) ?? '#059669',
        accepts_tips: p.acceptsTips,
        accepts_commissions: p.acceptsCommissions,
      },
      { onConflict: 'user_id' },
    )
    .select(SELECT)
    .single();

  if (error) {
    // 23505 is the unique index losing a race with a concurrent request for the
    // same handle. It is the caller's problem to fix, not a server fault.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'That handle is already taken.', code: 'HANDLE_TAKEN' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
