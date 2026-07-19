import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { createClient } from '../../../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

// POST /api/events/registrations/:id/checkin — toggle attendee check-in (organizer).
export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params; // registration id
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: reg } = await supabaseAdmin
    .from('event_registrations')
    .select('id, event_id')
    .eq('id', id)
    .maybeSingle();
  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: event } = await supabaseAdmin
    .from('fundraising_events')
    .select('created_by')
    .eq('id', reg.event_id)
    .maybeSingle();
  if (!event || event.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from('event_checkins')
    .select('id')
    .eq('registration_id', id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin.from('event_checkins').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ checked_in: false });
  }

  const { error } = await supabaseAdmin
    .from('event_checkins')
    .insert({ registration_id: id, event_id: reg.event_id, checked_in_by: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ checked_in: true });
}
