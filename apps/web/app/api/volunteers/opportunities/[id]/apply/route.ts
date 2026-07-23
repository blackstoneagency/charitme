import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';
import { VolunteerApplySchema } from '../../../../../../lib/volunteers';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/volunteers/opportunities/[id]/apply — apply to volunteer. Idempotent.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const oppQuery = supabaseAdmin
    .from('volunteer_opportunities')
    .select('id, status, slots, slots_filled')
    .is('deleted_at', null)
    .in('status', ['open', 'upcoming']);
  const { data: opp } = await (UUID_RE.test(id)
    ? oppQuery.eq('id', id)
    : oppQuery.eq('slug', id)
  ).maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Opportunity not found or closed' }, { status: 404 });
  if (opp.slots != null && opp.slots_filled >= opp.slots) {
    return NextResponse.json({ error: 'This opportunity is full' }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = VolunteerApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('volunteer_applications')
    .select('id, status')
    .eq('opportunity_id', opp.id)
    .eq('applicant_user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) return NextResponse.json({ application: existing, resumed: true });

  const { data, error } = await supabaseAdmin
    .from('volunteer_applications')
    .insert({
      opportunity_id: opp.id,
      applicant_user_id: user.id,
      message: parsed.data.message ?? null,
      status: 'applied',
    })
    .select('id, status, applied_at')
    .single();

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ application: data, resumed: false }, { status: 201 });
}
