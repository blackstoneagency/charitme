import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';
import { checkRateLimitDurable } from '../../../../../../lib/rate-limit-durable';
import { isAdmin } from '../../../../../../lib/roles';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

// POST /api/events/registrations/:id/checkin — toggle attendee check-in (organizer).
export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params; // registration id
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  if (!(await checkRateLimitDurable(`event-checkin-toggle:${user.id}`, 120, 60_000))) {
    return NextResponse.json({ error: 'Too many check-in attempts', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const { data: reg, error: regError } = await supabaseAdmin
    .from('event_registrations')
    .select('id,event_id,status')
    .eq('id', id)
    .maybeSingle();
  if (regError) return NextResponse.json({ error: 'Registration could not be verified', code: 'REGISTRATION_LOOKUP_UNAVAILABLE' }, { status: 503 });
  if (!reg) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  if (!['confirmed', 'partially_refunded'].includes(reg.status)) {
    return NextResponse.json({ error: 'This ticket is not valid for entry', code: 'TICKET_NOT_ACTIVE' }, { status: 409 });
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('fundraising_events')
    .select('created_by')
    .eq('id', reg.event_id)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: 'Event ownership could not be verified', code: 'EVENT_LOOKUP_UNAVAILABLE' }, { status: 503 });
  if (!event) return NextResponse.json({ error: 'Not found', code: 'EVENT_NOT_FOUND' }, { status: 404 });
  if (event.created_by !== user.id && !(await isAdmin(user.id, user.email))) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('event_checkins')
    .select('id')
    .eq('registration_id', id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: 'Check-in status could not be verified', code: 'CHECKIN_LOOKUP_UNAVAILABLE' }, { status: 503 });

  if (existing) {
    const { error } = await supabaseAdmin.from('event_checkins').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    return NextResponse.json({ checked_in: false });
  }

  const { error } = await supabaseAdmin
    .from('event_checkins')
    .insert({ registration_id: id, event_id: reg.event_id, checked_in_by: user.id });
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  return NextResponse.json({ checked_in: true });
}
