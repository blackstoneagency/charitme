import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';
import { challengeWindowValid, slugifyChallenge } from '../../../../lib/challenges';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().max(2000).optional(),
  goalType: z.enum(['donation_total', 'donation_count']).default('donation_total'),
  goalTargetCents: z.number().int().min(0).max(100_000_000_000).default(0),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(['draft', 'active']).default('draft'),
});

// GET /api/admin/challenges — all challenges incl. drafts (admin only).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id, user.email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('challenges')
    .select('id, slug, title, description, goal_type, goal_target_cents, starts_at, ends_at, status, created_at')
    .neq('status', 'archived')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Participant counts for context.
  const withCounts = await Promise.all((data ?? []).map(async (c) => {
    const { count } = await supabaseAdmin.from('challenge_participants').select('id', { count: 'exact', head: true }).eq('challenge_id', c.id);
    return { ...c, participantCount: count ?? 0 };
  }));
  return NextResponse.json({ challenges: withCounts });
}

// POST /api/admin/challenges — create a challenge (admin only).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id, user.email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  if (!challengeWindowValid(d.startsAt ?? null, d.endsAt ?? null)) {
    return NextResponse.json({ error: 'End time must be after the start time', code: 'BAD_WINDOW' }, { status: 400 });
  }

  const slug = `${slugifyChallenge(d.title)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: inserted, error } = await supabaseAdmin
    .from('challenges')
    .insert({
      slug,
      title: d.title,
      description: d.description ?? null,
      goal_type: d.goalType,
      goal_target_cents: d.goalTargetCents,
      starts_at: d.startsAt ?? new Date().toISOString(),
      ends_at: d.endsAt ?? null,
      status: d.status,
    })
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenge: inserted }, { status: 201 });
}
