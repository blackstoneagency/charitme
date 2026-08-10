import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { isAdmin } from '../../../../lib/roles';

export const dynamic = 'force-dynamic';

const CheckInSchema = z.object({ code: z.string().uuid() });

function apiError(status: number, error: string, code: string, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error, code } : { error, code, details },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(401, 'Unauthorized', 'UNAUTHORIZED');

  if (!(await checkRateLimitDurable(`event-ticket-checkin:${user.id}`, 120, 60_000))) {
    return apiError(429, 'Too many check-in attempts', 'RATE_LIMITED');
  }

  const parsed = CheckInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, 'Invalid ticket code', 'INVALID_INPUT', parsed.error.flatten());
  }

  const { data: registration, error: registrationError } = await supabaseAdmin
    .from('event_registrations')
    .select('id,event_id,attendee_name,quantity,status')
    .eq('ticket_code', parsed.data.code)
    .maybeSingle();
  if (registrationError) return apiError(503, 'Ticket could not be verified', 'TICKET_LOOKUP_UNAVAILABLE');
  if (!registration) return apiError(404, 'Ticket not found', 'NOT_FOUND');
  if (!['confirmed', 'partially_refunded'].includes(registration.status)) {
    return apiError(409, 'This ticket is not valid for entry', 'TICKET_NOT_ACTIVE');
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('fundraising_events')
    .select('id,title,created_by')
    .eq('id', registration.event_id)
    .maybeSingle();
  if (eventError) return apiError(503, 'Event ownership could not be verified', 'EVENT_LOOKUP_UNAVAILABLE');
  if (!event) return apiError(404, 'Event not found', 'EVENT_NOT_FOUND');

  if (event.created_by !== user.id && !(await isAdmin(user.id, user.email))) {
    return apiError(403, 'Forbidden', 'FORBIDDEN');
  }

  const { error: checkinError } = await supabaseAdmin
    .from('event_checkins')
    .upsert(
      {
        registration_id: registration.id,
        event_id: event.id,
        checked_in_by: user.id,
        checked_in_at: new Date().toISOString(),
      },
      { onConflict: 'registration_id', ignoreDuplicates: true },
    );
  if (checkinError) return apiError(500, 'Check-in could not be saved', 'INTERNAL_ERROR');

  return NextResponse.json({
    checked_in: true,
    event_title: event.title,
    attendee_name: registration.attendee_name ?? 'Guest',
    quantity: registration.quantity,
  });
}
