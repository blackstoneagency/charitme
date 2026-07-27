import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  remainingCapacity,
  ticketsRemaining,
  isTicketSoldOut,
  isEventFree,
  lowestTicketPriceCents,
} from '../lib/events-core';

// ─────────────────────────────────────────────────────────────────────────────
// `event_tickets` shipped with the events schema and was seeded (240 rows in
// production) but no application code ever read it, while the RSVP panel
// hard-coded "RSVP — it's free". An event with paid tiers therefore advertised
// itself as free and never showed a price.
// ─────────────────────────────────────────────────────────────────────────────

const tier = (price: number, limit: number | null = null, sold = 0) => ({
  price_cents: price,
  quantity_limit: limit,
  sold_count: sold,
});

describe('ticketsRemaining', () => {
  it('is null for an unlimited tier', () => {
    expect(ticketsRemaining(tier(1000, null, 40))).toBeNull();
  });

  it('subtracts sold from the limit', () => {
    expect(ticketsRemaining(tier(1000, 50, 20))).toBe(30);
  });

  it('never reports a negative remainder when oversold', () => {
    // sold_count is maintained by writers; an oversell must read as 0, not -5.
    expect(ticketsRemaining(tier(1000, 50, 55))).toBe(0);
  });

  it('treats a negative sold_count as zero sold', () => {
    expect(ticketsRemaining(tier(1000, 50, -3))).toBe(50);
  });
});

describe('isTicketSoldOut', () => {
  it('is true only when a limited tier is exhausted', () => {
    expect(isTicketSoldOut(tier(500, 10, 10))).toBe(true);
    expect(isTicketSoldOut(tier(500, 10, 9))).toBe(false);
  });

  it('an unlimited tier is never sold out', () => {
    expect(isTicketSoldOut(tier(500, null, 10_000))).toBe(false);
  });
});

describe('isEventFree', () => {
  it('an event with no tiers is a plain free RSVP', () => {
    expect(isEventFree([])).toBe(true);
  });

  it('is false as soon as one tier costs money', () => {
    expect(isEventFree([tier(0), tier(2500)])).toBe(false);
  });

  it('is true when every tier is zero-priced', () => {
    expect(isEventFree([tier(0), tier(0)])).toBe(true);
  });
});

describe('lowestTicketPriceCents', () => {
  it('ignores free tiers when reporting a "from" price', () => {
    expect(lowestTicketPriceCents([tier(0), tier(5000), tier(2500)])).toBe(2500);
  });

  it('is null when nothing costs anything', () => {
    expect(lowestTicketPriceCents([tier(0)])).toBeNull();
    expect(lowestTicketPriceCents([])).toBeNull();
  });
});

describe('the event page no longer claims free unconditionally', () => {
  const page = readFileSync(join(__dirname, '../app/events/[slug]/page.tsx'), 'utf8');
  const panel = readFileSync(join(__dirname, '../app/events/[slug]/RsvpPanel.tsx'), 'utf8');

  it('reads the ticket tiers', () => {
    expect(page).toContain('listEventTickets');
  });

  it('drives the free claim from the tiers rather than hard-coding it', () => {
    expect(panel).toContain('free ?');
    expect(page).toContain('isEventFree(tickets)');
  });

  it('a failed ticket read does not downgrade a paid event to free', () => {
    // `free` must require a successful read — otherwise a timeout re-introduces
    // the original bug, silently.
    expect(page).toContain('!ticketsFailed && isEventFree(tickets)');
    expect(page).toContain('role="alert"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Registration capacity check.
//
// It used to read EVERY registration row for the event on EVERY signup attempt —
// O(registrations) on the hottest path a popular event has. It is now bounded by
// the event's own capacity, which is provably equivalent for the decision it makes.
// These tests pin the arithmetic that makes the bound safe.
// ─────────────────────────────────────────────────────────────────────────────
describe('capacity arithmetic makes a bounded read safe', () => {
  it('an unlimited event ignores the registered total entirely', () => {
    // So the route can skip the query outright.
    for (const capacity of [null, 0, -5]) {
      expect(remainingCapacity(capacity, 0)).toBe(Number.POSITIVE_INFINITY);
      expect(remainingCapacity(capacity, 10_000)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it('reading at most `capacity` rows decides fullness identically', () => {
    // Every row has quantity >= 1, so `capacity` rows already sum to >= capacity.
    const capacity = 10;
    // True total below capacity: row count is below capacity too, nothing truncated.
    expect(remainingCapacity(capacity, 7)).toBe(3);
    // Truncated read still reports >= capacity, so it still reads as full.
    expect(remainingCapacity(capacity, capacity)).toBe(0);
    expect(remainingCapacity(capacity, 999)).toBe(0);
  });

  it('the route bounds the read by the event capacity', () => {
    const src = readFileSync(join(__dirname, '../app/api/events/[id]/register/route.ts'), 'utf8');
    expect(src).toMatch(/\.limit\(event\.capacity\)/);
    // …and skips it altogether when capacity is unlimited.
    expect(src).toMatch(/if \(event\.capacity != null && event\.capacity > 0\)/);
  });
});
