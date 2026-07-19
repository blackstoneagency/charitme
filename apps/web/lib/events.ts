// Pure business logic for fundraising events.
// No Supabase/Next imports — unit-testable, reusable server + client.

export const EVENT_TYPES = ['fundraiser', 'gala', 'giving_day', 'livestream', 'auction', 'registration'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ['draft', 'published', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export function isEventType(v: unknown): v is EventType {
  return typeof v === 'string' && (EVENT_TYPES as readonly string[]).includes(v);
}

export function isEventStatus(v: unknown): v is EventStatus {
  return typeof v === 'string' && (EVENT_STATUSES as readonly string[]).includes(v);
}

/** Upcoming = starts in the future. */
export function isUpcoming(startsAt: string, now: Date = new Date()): boolean {
  const s = new Date(startsAt).getTime();
  return !Number.isNaN(s) && s > now.getTime();
}

/** Live = started and (no end, or not yet ended). */
export function isLive(startsAt: string, endsAt: string | null, now: Date = new Date()): boolean {
  const s = new Date(startsAt).getTime();
  if (Number.isNaN(s) || s > now.getTime()) return false;
  if (!endsAt) return true;
  const e = new Date(endsAt).getTime();
  return Number.isNaN(e) ? true : e >= now.getTime();
}

/** Past = has an end that already passed, or started >24h ago with no end. */
export function isPast(startsAt: string, endsAt: string | null, now: Date = new Date()): boolean {
  const t = now.getTime();
  if (endsAt) {
    const e = new Date(endsAt).getTime();
    return !Number.isNaN(e) && e < t;
  }
  const s = new Date(startsAt).getTime();
  return !Number.isNaN(s) && s + 86_400_000 < t;
}

/** Remaining tickets given a limit and sold count. null = unlimited. */
export function ticketsRemaining(quantityLimit: number | null, soldCount: number): number | null {
  if (quantityLimit == null) return null;
  return Math.max(0, (Number(quantityLimit) || 0) - (Number(soldCount) || 0));
}

export function isTicketAvailable(quantityLimit: number | null, soldCount: number): boolean {
  const remaining = ticketsRemaining(quantityLimit, soldCount);
  return remaining == null || remaining > 0;
}

export function eventTypeLabel(type: string): string {
  switch (type) {
    case 'fundraiser':
      return 'Fundraiser';
    case 'gala':
      return 'Gala';
    case 'giving_day':
      return 'Giving Day';
    case 'livestream':
      return 'Livestream';
    case 'auction':
      return 'Auction';
    case 'registration':
      return 'Registration';
    default:
      return 'Event';
  }
}
