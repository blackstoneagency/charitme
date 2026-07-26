// ─────────────────────────────────────────────────────────────────────────────
// Events — pure domain logic (no I/O, unit-testable). Sibling `events.ts` does I/O.
// Built on the existing `fundraising_events` / `event_registrations` tables.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';

export const EVENT_TYPES = [
  'fundraiser',
  'gala',
  'giving_day',
  'livestream',
  'auction',
  'registration',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';

export interface FundraisingEvent {
  id: string;
  created_by: string | null;
  campaign_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  virtual_url: string | null;
  cover_image_url: string | null;
  capacity: number | null;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  ticket_id: string | null;
  attendee_id: string | null;
  attendee_email: string | null;
  attendee_name: string | null;
  quantity: number;
  amount_cents: number;
  created_at: string;
}

/** Remaining spots given capacity and quantity already registered. Infinity if uncapped. */
export function remainingCapacity(capacity: number | null, registeredQty: number): number {
  if (capacity == null || capacity <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, capacity - registeredQty);
}

/** Whether the event is upcoming (not yet ended), given `now`. */
export function isUpcoming(event: Pick<FundraisingEvent, 'starts_at' | 'ends_at'>, now: Date = new Date()): boolean {
  const end = event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at);
  return end.getTime() >= now.getTime();
}

/** Whether registration is open: published, upcoming, and with remaining capacity. */
export function isRegistrationOpen(
  event: Pick<FundraisingEvent, 'status' | 'starts_at' | 'ends_at' | 'capacity'>,
  registeredQty: number,
  now: Date = new Date(),
): boolean {
  return event.status === 'published' && isUpcoming(event, now) && remainingCapacity(event.capacity, registeredQty) > 0;
}

/** URL-safe slug from a title (matches the repo's grant slug style). */
export function slugifyTitle(title: string): string {
  return (
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'event'
  );
}

// ── Validation schemas ────────────────────────────────────────────────────────

export const EventCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(12000).optional().nullable(),
    event_type: z.enum(EVENT_TYPES).default('fundraiser'),
    starts_at: z.string().datetime(),
    ends_at: z.string().datetime().optional().nullable(),
    location: z.string().trim().max(240).optional().nullable(),
    virtual_url: z.string().url().max(500).optional().nullable(),
    cover_image_url: z.string().url().max(500).optional().nullable(),
    capacity: z.number().int().min(1).max(1_000_000).optional().nullable(),
    campaign_id: z.string().uuid().optional().nullable(),
    status: z.enum(['draft', 'published']).default('published'),
  })
  .refine((v) => !v.ends_at || new Date(v.ends_at) >= new Date(v.starts_at), {
    message: 'ends_at must be on or after starts_at',
    path: ['ends_at'],
  });

export const EventUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(12000).optional().nullable(),
  event_type: z.enum(EVENT_TYPES).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional().nullable(),
  location: z.string().trim().max(240).optional().nullable(),
  virtual_url: z.string().url().max(500).optional().nullable(),
  cover_image_url: z.string().url().max(500).optional().nullable(),
  capacity: z.number().int().min(1).max(1_000_000).optional().nullable(),
  status: z.enum(['draft', 'published', 'completed', 'cancelled']).optional(),
});

export const RegistrationCreateSchema = z.object({
  quantity: z.number().int().min(1).max(20).default(1),
  attendee_name: z.string().trim().max(160).optional().nullable(),
  attendee_email: z.string().email().max(240).optional().nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Ticket tiers.
//
// `event_tickets` shipped with the events schema and was seeded (240 rows in
// production) but read by NO application code, while the RSVP panel hard-coded
// "RSVP — it's free". So an event with paid tiers advertised itself as free and
// never showed its prices. These helpers are pure so they can be unit-tested
// without a database.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventTicket {
  id: string;
  event_id: string;
  title: string;
  price_cents: number;
  /** null = unlimited. */
  quantity_limit: number | null;
  sold_count: number;
  created_at: string;
}

/** Tickets left, or null when the tier is unlimited. Never negative. */
export function ticketsRemaining(ticket: Pick<EventTicket, 'quantity_limit' | 'sold_count'>): number | null {
  if (ticket.quantity_limit === null || !Number.isFinite(ticket.quantity_limit)) return null;
  return Math.max(0, ticket.quantity_limit - Math.max(0, ticket.sold_count ?? 0));
}

export function isTicketSoldOut(ticket: Pick<EventTicket, 'quantity_limit' | 'sold_count'>): boolean {
  return ticketsRemaining(ticket) === 0;
}

/**
 * True when every tier costs nothing — the only case where calling the event
 * "free" is accurate. An event with no tiers at all is a plain RSVP, also free.
 */
export function isEventFree(tickets: Pick<EventTicket, 'price_cents'>[]): boolean {
  return tickets.every((t) => (t.price_cents ?? 0) <= 0);
}

/** Cheapest non-zero price, for a "from $X" label. Null when entirely free. */
export function lowestTicketPriceCents(tickets: Pick<EventTicket, 'price_cents'>[]): number | null {
  const paid = tickets.map((t) => t.price_cents ?? 0).filter((c) => c > 0);
  return paid.length > 0 ? Math.min(...paid) : null;
}
