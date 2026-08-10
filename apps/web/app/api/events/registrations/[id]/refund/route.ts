import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '../../../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { checkRateLimitDurable } from '../../../../../../lib/rate-limit-durable';
import { isAdmin } from '../../../../../../lib/roles';
import { stripe } from '../../../../../../lib/stripe';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const RefundSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

function apiError(status: number, error: string, code: string, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error, code } : { error, code, details },
    { status },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(401, 'Unauthorized', 'UNAUTHORIZED');

  if (!(await checkRateLimitDurable(`event-ticket-refund:${user.id}`, 6, 60_000))) {
    return apiError(429, 'Too many refund attempts', 'RATE_LIMITED');
  }

  const parsed = RefundSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(400, 'Invalid refund request', 'INVALID_INPUT', parsed.error.flatten());
  }

  const { data: registration, error: registrationError } = await supabaseAdmin
    .from('event_registrations')
    .select('id,event_id,attendee_id,amount_cents,status,stripe_payment_intent_id')
    .eq('id', id)
    .maybeSingle();
  if (registrationError) return apiError(503, 'Registration could not be verified', 'REGISTRATION_LOOKUP_UNAVAILABLE');
  if (!registration) return apiError(404, 'Registration not found', 'NOT_FOUND');

  const { data: event, error: eventError } = await supabaseAdmin
    .from('fundraising_events')
    .select('created_by,starts_at')
    .eq('id', registration.event_id)
    .maybeSingle();
  if (eventError) return apiError(503, 'Event ownership could not be verified', 'EVENT_LOOKUP_UNAVAILABLE');
  if (!event) return apiError(404, 'Event not found', 'EVENT_NOT_FOUND');

  const admin = await isAdmin(user.id, user.email);
  const attendee = registration.attendee_id === user.id;
  const organizer = event.created_by === user.id;
  if (!attendee && !organizer && !admin) return apiError(403, 'Forbidden', 'FORBIDDEN');
  if (attendee && !organizer && !admin && new Date(event.starts_at).getTime() <= Date.now()) {
    return apiError(409, 'Self-service refunds close when the event starts', 'REFUND_WINDOW_CLOSED');
  }
  if (!['confirmed', 'partially_refunded'].includes(registration.status)) {
    return apiError(409, 'This registration is not eligible for a refund', 'REFUND_NOT_AVAILABLE');
  }
  if (!registration.stripe_payment_intent_id || registration.amount_cents <= 0) {
    return apiError(409, 'This registration has no refundable payment', 'NO_REFUNDABLE_PAYMENT');
  }

  try {
    await stripe.refunds.create(
      {
        payment_intent: registration.stripe_payment_intent_id,
        reverse_transfer: true,
        reason: 'requested_by_customer',
        metadata: {
          type: 'event_ticket',
          registrationId: registration.id,
          requestedBy: attendee ? 'attendee' : admin ? 'admin' : 'organizer',
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        },
      },
      { idempotencyKey: `event_ticket_refund_${registration.id}` },
    );
  } catch {
    return apiError(502, 'Stripe could not start the refund', 'STRIPE_REFUND_FAILED');
  }

  const { error: updateError } = await supabaseAdmin
    .from('event_registrations')
    .update({ status: 'refund_pending' })
    .eq('id', registration.id)
    .in('status', ['confirmed', 'partially_refunded']);
  if (updateError) {
    return apiError(503, 'The refund started but its local status could not be recorded', 'REFUND_STATUS_UNAVAILABLE');
  }

  return NextResponse.json({ status: 'refund_pending' }, { status: 202 });
}
