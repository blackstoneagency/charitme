import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { isAdmin } from '../../../../lib/roles';
import { generateCheckInCode } from '../../../../lib/volunteer-shifts-core';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  opportunity_id: z.string().uuid(),
  title: z.string().min(2).max(120),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  location: z.string().max(200).optional(),
  is_remote: z.boolean().optional(),
  capacity: z.number().int().min(0).max(10_000).nullable().optional(),
  notes: z.string().max(1000).optional(),
});

// GET /api/volunteers/shifts?opportunity_id= — scheduled shifts for an
// opportunity. Public: a volunteer has to see what they can sign up for. The
// check-in code is deliberately NOT selected — publishing it would let anyone
// check in without being present.
export async function GET(request: NextRequest) {
  const opportunityId = request.nextUrl.searchParams.get('opportunity_id');
  if (!opportunityId) return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('volunteer_shifts')
    .select('id, opportunity_id, title, starts_at, ends_at, location, is_remote, capacity, filled_count, status')
    .eq('opportunity_id', opportunityId)
    .eq('status', 'scheduled')
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ shifts: data ?? [] });
}

// POST /api/volunteers/shifts — the opportunity owner (or an admin) schedules a
// shift. The check-in code is generated server-side and returned only here, to
// the organizer who will print or display the QR.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (Date.parse(input.ends_at) <= Date.parse(input.starts_at)) {
    return NextResponse.json({ error: 'A shift must end after it starts.' }, { status: 400 });
  }

  const { data: opp } = await supabaseAdmin
    .from('volunteer_opportunities')
    .select('id, created_by')
    .eq('id', input.opportunity_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (opp.created_by !== user.id && !(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // `checkin_code` is unique; retry a couple of times so an unlucky collision
  // does not surface as a 500 to the organizer.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabaseAdmin
      .from('volunteer_shifts')
      .insert({
        opportunity_id: input.opportunity_id,
        title: input.title,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        location: input.location ?? null,
        is_remote: input.is_remote ?? false,
        capacity: input.capacity ?? null,
        notes: input.notes ?? null,
        checkin_code: generateCheckInCode(),
        created_by: user.id,
      })
      .select('id, opportunity_id, title, starts_at, ends_at, capacity, filled_count, status, checkin_code')
      .single();

    if (!error) return NextResponse.json({ shift: data }, { status: 201 });
    if ((error as { code?: string }).code !== '23505') {
      return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Could not allocate a check-in code — retry.' }, { status: 503 });
}
