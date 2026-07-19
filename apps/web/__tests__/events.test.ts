import { describe, expect, it } from 'vitest';
import {
  remainingCapacity,
  isUpcoming,
  isRegistrationOpen,
  slugifyTitle,
  EventCreateSchema,
  RegistrationCreateSchema,
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
