import { describe, expect, it } from 'vitest';
import {
  eventTypeLabel,
  isEventStatus,
  isEventType,
  isLive,
  isPast,
  isTicketAvailable,
  isUpcoming,
  ticketsRemaining,
  EVENT_TYPES,
} from '../lib/events';

const now = new Date('2026-07-19T12:00:00Z');

describe('event timing', () => {
  it('detects upcoming events', () => {
    expect(isUpcoming('2026-07-20T12:00:00Z', now)).toBe(true);
    expect(isUpcoming('2026-07-18T12:00:00Z', now)).toBe(false);
  });
  it('detects live events (started, not ended)', () => {
    expect(isLive('2026-07-19T10:00:00Z', '2026-07-19T14:00:00Z', now)).toBe(true);
    expect(isLive('2026-07-19T10:00:00Z', null, now)).toBe(true);
    expect(isLive('2026-07-20T10:00:00Z', null, now)).toBe(false); // not started
    expect(isLive('2026-07-19T08:00:00Z', '2026-07-19T09:00:00Z', now)).toBe(false); // ended
  });
  it('detects past events', () => {
    expect(isPast('2026-07-19T08:00:00Z', '2026-07-19T09:00:00Z', now)).toBe(true);
    expect(isPast('2026-07-17T08:00:00Z', null, now)).toBe(true); // >24h, no end
    expect(isPast('2026-07-19T11:30:00Z', null, now)).toBe(false); // recent, no end
  });
});

describe('ticket availability', () => {
  it('computes remaining, null = unlimited', () => {
    expect(ticketsRemaining(100, 40)).toBe(60);
    expect(ticketsRemaining(10, 15)).toBe(0);
    expect(ticketsRemaining(null, 999)).toBeNull();
  });
  it('reports availability', () => {
    expect(isTicketAvailable(100, 40)).toBe(true);
    expect(isTicketAvailable(10, 10)).toBe(false);
    expect(isTicketAvailable(null, 5000)).toBe(true);
  });
});

describe('type + status helpers', () => {
  it('validates types and statuses', () => {
    expect(isEventType('gala')).toBe(true);
    expect(isEventType('party')).toBe(false);
    expect(isEventStatus('published')).toBe(true);
    expect(isEventStatus('weird')).toBe(false);
  });
  it('labels every type', () => {
    for (const t of EVENT_TYPES) expect(eventTypeLabel(t)).toBeTruthy();
    expect(eventTypeLabel('unknown')).toBe('Event');
  });
});
