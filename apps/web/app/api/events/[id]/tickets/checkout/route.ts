import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '../../../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../../../lib/supabase';
import { EventTicketCheckoutSchema } from '../../../../../../lib/events-core';
import { checkRateLimitDurable } from '../../../../../../lib/rate-limit-durable';
import { getAppOrigin } from '../../../../../../lib/auth-config';
import {
  checkoutPaymentMethodTypes,
  createCheckoutSession,
  stripe,
} from '../../../../../../lib/stripe';
import {
  PayoutLookupUnavailableError,
  resolvePayoutDestination,
} from '../../../../../../lib/payout-destination';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

type ReservationRow = {
  registration_id: string;
  unit_price_cents: number;
  total_cents: number;
  currency: string;
};

function readReservation(value: unknown): ReservationRow | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const row: unknown = value[0];
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.registration_id !== 'string'
    || typeof record.unit_price_cents !== 'number'
    || typeof record.total_cents !== 'number'
    || typeof record.currency !== 'string'
  ) return null;
  return {
    registration_id: record.registration_id,
    unit_price_cents: record.unit_price_cents,
    total_cents: record.total_cents,
    currency: record.currency,
  };
}

function apiError(status: number, error: string, code: string, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error, code } : { error, code, details },
    { status },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(401, 'Unauthorized', 'UNAUTHORIZED');

  if (!(await checkRateLimitDurable(`event-ticket-checkout:${user.id}`, 12, 60_000))) {
    return apiError(429, 'Too many checkout attempts', 'RATE_LIMITED');
  }

  const body = await request.json().catch(() => null);
  const parsed = EventTicketCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, 'Invalid ticket checkout request', 'INVALID_INPUT', parsed.error.flatten());
  }

  const { data: event, error: eventError } = await supabaseAdmin
    .from('fundraising_events')
    .select('id,title,slug,status,starts_at,ends_at,created_by,campaign_id')
    .eq('id', eventId)
    .maybeSingle();
  if (eventError) return apiError(503, 'Ticket checkout is temporarily unavailable', 'EVENT_LOOKUP_UNAVAILABLE');
  if (!event) return apiError(404, 'Event not found', 'NOT_FOUND');
  if (!event.created_by) return apiError(409, 'This event cannot accept payments yet', 'PAYOUT_NOT_READY');

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('event_tickets')
    .select('id,event_id,title,price_cents,quantity_limit,sold_count')
    .eq('id', parsed.data.ticket_id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (ticketError) return apiError(503, 'Ticket checkout is temporarily unavailable', 'TICKET_LOOKUP_UNAVAILABLE');
  if (!ticket) return apiError(404, 'Ticket not found', 'TICKET_NOT_FOUND');
  if (ticket.price_cents <= 0) {
    return apiError(400, 'This ticket does not require payment', 'FREE_TICKET');
  }

  let payoutSubject: { user_id: string; beneficiary_profile_id?: string | null } = {
    user_id: event.created_by,
  };
  if (event.campaign_id) {
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('user_id,beneficiary_profile_id')
      .eq('id', event.campaign_id)
      .maybeSingle();
    if (campaignError) {
      return apiError(503, 'Payout readiness could not be verified', 'PAYOUT_LOOKUP_UNAVAILABLE');
    }
    if (campaign) payoutSubject = campaign;
  }

  let destination;
  try {
    destination = await resolvePayoutDestination(payoutSubject);
  } catch (error: unknown) {
    if (error instanceof PayoutLookupUnavailableError) {
      return apiError(503, 'Payout readiness could not be verified', 'PAYOUT_LOOKUP_UNAVAILABLE');
    }
    return apiError(503, 'Ticket checkout is temporarily unavailable', 'CHECKOUT_UNAVAILABLE');
  }
  if (!destination) {
    return apiError(409, 'The event organizer must finish payout setup before selling tickets', 'PAYOUT_NOT_READY');
  }

  const attendeeEmail = parsed.data.attendee_email ?? user.email ?? '';
  const { data: reservedData, error: reserveError } = await supabaseAdmin.rpc('reserve_event_ticket', {
    p_event_id: eventId,
    p_ticket_id: ticket.id,
    p_attendee_id: user.id,
    p_attendee_email: attendeeEmail,
    p_attendee_name: parsed.data.attendee_name ?? '',
    p_quantity: parsed.data.quantity,
    p_checkout_token: parsed.data.request_key,
  });
  if (reserveError) {
    if (reserveError.code === '23505') {
      return apiError(409, 'You already have an active registration for this event', 'ALREADY_REGISTERED');
    }
    if (reserveError.code === 'P0001') {
      return apiError(409, 'This ticket is no longer available in that quantity', 'TICKET_UNAVAILABLE');
    }
    if (reserveError.code === 'P0002') {
      return apiError(404, 'Event or ticket not found', 'NOT_FOUND');
    }
    return apiError(503, 'Ticket inventory could not be reserved', 'RESERVATION_UNAVAILABLE');
  }

  const reservation = readReservation(reservedData);
  if (!reservation || reservation.total_cents !== ticket.price_cents * parsed.data.quantity) {
    return apiError(503, 'Ticket pricing could not be verified', 'PRICING_UNAVAILABLE');
  }

  const origin = getAppOrigin();
  const metadata = {
    type: 'event_ticket',
    registrationId: reservation.registration_id,
    eventId,
    ticketId: ticket.id,
    attendeeId: user.id,
    quantity: String(parsed.data.quantity),
  };
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: checkoutPaymentMethodTypes('stripe', 'payment'),
    line_items: [{
      quantity: parsed.data.quantity,
      price_data: {
        currency: reservation.currency,
        unit_amount: reservation.unit_price_cents,
        product_data: {
          name: ticket.title,
          description: `Admission to ${event.title}`,
        },
      },
    }],
    ...(attendeeEmail ? { customer_email: attendeeEmail } : {}),
    success_url: `${origin}/dashboard/tickets?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/events/${encodeURIComponent(event.slug)}?checkout=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    metadata,
    payment_intent_data: {
      metadata,
      transfer_data: { destination: destination.stripeAccountId },
    },
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await createCheckoutSession(
      sessionParams,
      `event_ticket_${reservation.registration_id}_${parsed.data.request_key}`,
    );
  } catch {
    await supabaseAdmin.rpc('release_event_ticket_reservation', {
      p_registration_id: reservation.registration_id,
      p_stripe_checkout_session_id: null,
    });
    return apiError(502, 'Stripe checkout could not be started', 'STRIPE_CHECKOUT_FAILED');
  }

  const { data: attached, error: attachError } = await supabaseAdmin.rpc('attach_event_ticket_checkout', {
    p_registration_id: reservation.registration_id,
    p_checkout_token: parsed.data.request_key,
    p_stripe_checkout_session_id: session.id,
  });
  if (attachError || attached !== true || !session.url) {
    await stripe.checkout.sessions.expire(session.id).catch(() => null);
    await supabaseAdmin.rpc('release_event_ticket_reservation', {
      p_registration_id: reservation.registration_id,
      p_stripe_checkout_session_id: null,
    });
    return apiError(503, 'Ticket checkout could not be finalized', 'CHECKOUT_ATTACH_FAILED');
  }

  return NextResponse.json(
    { url: session.url, registration_id: reservation.registration_id },
    { status: 201 },
  );
}
