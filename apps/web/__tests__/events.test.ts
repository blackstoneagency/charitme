import { describe, expect, it } from 'vitest';
import {
  remainingCapacity,
  isUpcoming,
  isRegistrationOpen,
  slugifyTitle,
  EventCreateSchema,
  EventTicketCheckoutSchema,
  RegistrationCreateSchema,
  dollarsInputToCents,
} from '../lib/events-core';

const NOW = new Date('2026-07-19T12:00:00Z');
const FUTURE = '2026-08-01T18:00:00Z';
const PAST = '2026-07-01T18:00:00Z';

describe('remainingCapacity', () => {
  it('is Infinity when uncapped', () => {
    expect(remainingCapacity(null, 5)).toBe(Number.POSITIVE_INFINITY);
    expect(remainingCapacity(0, 5)).toBe(Number.POSITIVE_INFINITY);
  });
  it('subtracts registered quantity, never negative', () => {
    expect(remainingCapacity(100, 40)).toBe(60);
    expect(remainingCapacity(100, 120)).toBe(0);
  });
});

describe('isUpcoming', () => {
  it('is true for a future event and false for a past one', () => {
    expect(isUpcoming({ starts_at: FUTURE, ends_at: null }, NOW)).toBe(true);
    expect(isUpcoming({ starts_at: PAST, ends_at: null }, NOW)).toBe(false);
  });
  it('uses ends_at when present', () => {
    expect(isUpcoming({ starts_at: PAST, ends_at: FUTURE }, NOW)).toBe(true);
  });
});

describe('isRegistrationOpen', () => {
  const base = { status: 'published' as const, starts_at: FUTURE, ends_at: null, capacity: 100 };
  it('is open for a published, upcoming, non-full event', () => {
    expect(isRegistrationOpen(base, 10, NOW)).toBe(true);
  });
  it('is closed when full', () => {
    expect(isRegistrationOpen(base, 100, NOW)).toBe(false);
  });
  it('is closed when not published', () => {
    expect(isRegistrationOpen({ ...base, status: 'draft' }, 0, NOW)).toBe(false);
  });
  it('is closed when the event has passed', () => {
    expect(isRegistrationOpen({ ...base, starts_at: PAST, ends_at: PAST }, 0, NOW)).toBe(false);
  });
});

describe('slugifyTitle', () => {
  it('produces a url-safe slug', () => {
    expect(slugifyTitle('Spring Charity Gala!')).toBe('spring-charity-gala');
  });
  it('falls back to "event" when empty', () => {
    expect(slugifyTitle('!!!')).toBe('event');
  });
});

describe('validation schemas', () => {
  it('accepts a valid event', () => {
    const r = EventCreateSchema.safeParse({ title: 'Spring Gala', starts_at: FUTURE, event_type: 'gala' });
    expect(r.success).toBe(true);
  });
  it('rejects ends_at before starts_at', () => {
    const r = EventCreateSchema.safeParse({ title: 'Spring Gala', starts_at: FUTURE, ends_at: PAST });
    expect(r.success).toBe(false);
  });
  it('rejects a bad event_type', () => {
    expect(EventCreateSchema.safeParse({ title: 'X Gala', starts_at: FUTURE, event_type: 'party' }).success).toBe(false);
  });
  it('defaults registration quantity to 1 and caps it', () => {
    const r = RegistrationCreateSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(1);
    expect(RegistrationCreateSchema.safeParse({ quantity: 99 }).success).toBe(false);
  });
  it('validates paid ticket tiers and Stripe checkout keys', () => {
    expect(EventCreateSchema.safeParse({
      title: 'Spring Gala',
      starts_at: FUTURE,
      tickets: [{ title: 'General admission', price_cents: 2500, quantity_limit: 100 }],
    }).success).toBe(true);
    expect(EventCreateSchema.safeParse({
      title: 'Spring Gala',
      starts_at: FUTURE,
      tickets: [{ title: 'Invalid', price_cents: 49 }],
    }).success).toBe(false);
    expect(EventTicketCheckoutSchema.safeParse({
      ticket_id: '11111111-1111-4111-8111-111111111111',
      request_key: '22222222-2222-4222-8222-222222222222',
      quantity: 2,
    }).success).toBe(true);
  });
});

describe('dollarsInputToCents', () => {
  it('converts decimal input without floating-point money math', () => {
    expect(dollarsInputToCents('25')).toBe(2500);
    expect(dollarsInputToCents('25.5')).toBe(2550);
    expect(dollarsInputToCents('25.05')).toBe(2505);
  });
  it('rejects ambiguous or over-precise values', () => {
    expect(dollarsInputToCents('25.005')).toBeNull();
    expect(dollarsInputToCents('-1')).toBeNull();
    expect(dollarsInputToCents('twenty')).toBeNull();
  });
});

// ── RLS policy logic simulation ───────────────────────────────────────────────
describe('event_registrations RLS: read scope', () => {
  function canRead(reg: { attendee_id: string; event_creator: string }, uid: string | null, isAdmin: boolean): boolean {
    return reg.attendee_id === uid || isAdmin || reg.event_creator === uid;
  }
  it('the attendee can read their registration', () => {
    expect(canRead({ attendee_id: 'a1', event_creator: 'o1' }, 'a1', false)).toBe(true);
  });
  it('the event organizer can read registrations', () => {
    expect(canRead({ attendee_id: 'a1', event_creator: 'o1' }, 'o1', false)).toBe(true);
  });
  it('an unrelated user cannot', () => {
    expect(canRead({ attendee_id: 'a1', event_creator: 'o1' }, 'x', false)).toBe(false);
  });
});
