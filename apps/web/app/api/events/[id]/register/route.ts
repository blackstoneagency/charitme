import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { getEventById, attendeeRegisteredQty } from '../../../../../lib/events';
import { RegistrationCreateSchema, isRegistrationOpen, remainingCapacity } from '../../../../../lib/events-core';
import { notify } from '../../../../../lib/notify';
import { eventRsvpReceived } from '../../../../../lib/notify-core';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

// POST /api/events/:id/register — free RSVP for a published event.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const event = await getEventById(id);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = RegistrationCreateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { quantity, attendee_name, attendee_email } = parsed.data;

  // Capacity check against the current total registered quantity.
  const { data: regs } = await supabaseAdmin
    .from('event_registrations')
    .select('quantity')
    .eq('event_id', id);
  const registeredQty = (regs ?? []).reduce((s, r) => s + (r.quantity as number), 0);

  if (!isRegistrationOpen(event, registeredQty)) {
    return NextResponse.json({ error: 'Registration is closed for this event' }, { status: 409 });
  }
  if (quantity > remainingCapacity(event.capacity, registeredQty)) {
    return NextResponse.json({ error: 'Not enough spots remaining' }, { status: 409 });
  }
  if (await attendeeRegisteredQty(id, user.id) > 0) {
    return NextResponse.json({ error: 'You are already registered for this event' }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('event_registrations')
    .insert({
      event_id: id,
      attendee_id: user.id,
      attendee_name: attendee_name ?? null,
      attendee_email: attendee_email ?? user.email ?? null,
      quantity,
      amount_cents: 0,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the event organizer of the new RSVP.
  await notify(
    event.created_by,
    eventRsvpReceived(attendee_name || user.email || 'A guest', event.title),
    { event_id: id },
  );

  return NextResponse.json({ id: data.id }, { status: 201 });
}
