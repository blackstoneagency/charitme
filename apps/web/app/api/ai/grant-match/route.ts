import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { checkRateLimit } from '../../../../lib/rate-limit';
import {
  GRANT_PUBLIC_COLUMNS,
  GrantMatchRequestSchema,
  rankGrantMatches,
  type Grant,
} from '../../../../lib/grants';

export const dynamic = 'force-dynamic';

// POST /api/ai/grant-match — rank live grants against an applicant's need using
// the deterministic matching model. When the caller is signed in, top matches are
// persisted to grant_matches so they surface in the dashboard.
export async function POST(request: NextRequest) {
  // Rate limit (by IP — the endpoint is callable unauthenticated): each request
  // runs a ~300-row grants scan and may upsert grant_matches, so cap abuse.
  // Consistent with the other /api/ai/* routes.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!checkRateLimit(`ai-grant-match:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = GrantMatchRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const req = parsed.data;

  // Candidate pool: live grants, narrowed by cheap filters when provided.
  let query = supabaseAdmin
    .from('grants')
    .select(GRANT_PUBLIC_COLUMNS)
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming'])
    .limit(300);
  if (req.category) query = query.eq('category', req.category);
  if (req.country) query = query.eq('country', req.country);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const grants = (data ?? []) as unknown as Grant[];
  const ranked = rankGrantMatches(grants, req);

  const byId = new Map(grants.map((g) => [g.id, g]));
  const matches = ranked.map((m) => ({
    ...m,
    grant: byId.get(m.grantId) ?? null,
  }));

  // Persist for signed-in users (best-effort; never blocks the response).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && ranked.length) {
    const rows = ranked.map((m) => ({
      grant_id: m.grantId,
      user_id: user.id,
      campaign_id: null,
      score: m.score,
      reasons: m.reasons,
    }));
    await supabaseAdmin
      .from('grant_matches')
      .upsert(rows, { onConflict: 'grant_id,user_id,campaign_id' });
  }

  return NextResponse.json({ matches, count: matches.length });
}
