import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isTicketAvailable } from '../../../../../lib/events';

export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
  ticketId: z.string().uuid().optional(),
  attendeeName: z.string().trim().max(120).optional(),
  quantity: z.number().int().min(1).max(20).optional(),
});

// POST /api/events/:slug/register — free RSVP / free-ticket registration.
// Paid tickets are handled via checkout (not in this endpoint) — see roadmap.
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  const { ticketId, attendeeName, quantity } = parsed.data;

  const { data: event } = await supabaseAdmin
    .from('fundraising_events')
    .select('id, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.status !== 'published') return NextResponse.json({ error: 'This event is not open for registration', code: 'NOT_PUBLISHED' }, { status: 409 });

  const qty = quantity ?? 1;
  const amountCents = 0;
  let ticketRow: { id: string; sold_count: number } | null = null;

  if (ticketId) {
    const { data: ticket } = await supabaseAdmin
      .from('event_tickets')
      .select('id, event_id, price_cents, quantity_limit, sold_count')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket || ticket.event_id !== event.id) return NextResponse.json({ error: 'Ticket not found for this event' }, { status: 404 });
    if ((ticket.price_cents ?? 0) > 0) {
      return NextResponse.json({ error: 'Paid tickets are purchased at checkout, not via free registration', code: 'PAID_TICKET' }, { status: 409 });
    }
    if (!isTicketAvailable(ticket.quantity_limit, ticket.sold_count)) {
      return NextResponse.json({ error: 'This ticket is sold out', code: 'SOLD_OUT' }, { status: 409 });
    }
    ticketRow = { id: ticket.id, sold_count: Number(ticket.sold_count) || 0 };
  }

  // One registration per attendee per event (idempotent-ish guard).
  const { data: existing } = await supabaseAdmin
    .from('event_registrations')
    .select('id')
    .eq('event_id', event.id)
    .eq('attendee_id', user.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'You are already registered for this event', code: 'ALREADY_REGISTERED' }, { status: 409 });

  const { data: inserted, error } = await supabaseAdmin
    .from('event_registrations')
    .insert({
      event_id: event.id,
      ticket_id: ticketId ?? null,
      attendee_id: user.id,
      attendee_email: user.email ?? null,
      attendee_name: attendeeName ?? null,
      quantity: qty,
      amount_cents: amountCents,
    })
    .select('id, event_id, quantity, created_at')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort sold_count increment for free tickets.
  if (ticketRow) {
    await supabaseAdmin.from('event_tickets').update({ sold_count: ticketRow.sold_count + qty }).eq('id', ticketRow.id).then(() => {}, () => {});
  }

  return NextResponse.json({ registration: inserted }, { status: 201 });
}
