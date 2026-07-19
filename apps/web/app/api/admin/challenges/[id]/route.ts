import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { challengeWindowValid } from '../../../../../lib/challenges';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  title: z.string().trim().min(4).max(140).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  goalTargetCents: z.number().int().min(0).max(100_000_000_000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  status: z.enum(['draft', 'active', 'ended', 'archived']).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

// PATCH /api/admin/challenges/:id — edit / activate / end a challenge (admin only).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isAdmin(user.id, user.email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const { data: current } = await supabaseAdmin.from('challenges').select('starts_at, ends_at').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const nextStart = d.startsAt !== undefined ? d.startsAt : (current.starts_at as string | null);
  const nextEnd = d.endsAt !== undefined ? d.endsAt : (current.ends_at as string | null);
  if (!challengeWindowValid(nextStart, nextEnd)) {
    return NextResponse.json({ error: 'End time must be after the start time', code: 'BAD_WINDOW' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (d.title !== undefined) update.title = d.title;
  if (d.description !== undefined) update.description = d.description;
  if (d.goalTargetCents !== undefined) update.goal_target_cents = d.goalTargetCents;
  if (d.startsAt !== undefined) update.starts_at = d.startsAt;
  if (d.endsAt !== undefined) update.ends_at = d.endsAt;
  if (d.status !== undefined) update.status = d.status;

  const { data: updated, error } = await supabaseAdmin.from('challenges').update(update).eq('id', id).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenge: updated });
}
