import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
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
