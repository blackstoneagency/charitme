import { describe, expect, it } from 'vitest';
import {
  buildBreadcrumbJsonLd,
  buildEventJsonLd,
  buildItemListJsonLd,
  jsonLdScript,
} from '../lib/structured-data';

describe('buildEventJsonLd', () => {
  it('builds an offline free event', () => {
    const j = buildEventJsonLd({ title: 'Gala', slug: 'gala', startsAt: '2026-08-01T18:00:00Z', location: 'Austin, TX' });
    expect(j['@type']).toBe('Event');
    expect(j.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect((j.location as Record<string, unknown>)['@type']).toBe('Place');
    expect(j.isAccessibleForFree).toBe(true);
    expect((j.offers as Record<string, unknown>).price).toBe('0');
    expect(j.url).toBe('https://www.charitme.com/events/gala');
  });
  it('builds an online paid event with a virtual location + price', () => {
    const j = buildEventJsonLd({ title: 'Webinar', slug: 'web', startsAt: '2026-08-01T18:00:00Z', virtualUrl: 'https://stream.example/x', lowPriceCents: 2500, currency: 'usd' });
    expect(j.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode');
    expect((j.location as Record<string, unknown>)['@type']).toBe('VirtualLocation');
    expect(j.isAccessibleForFree).toBe(false);
    const offers = j.offers as Record<string, unknown>;
    expect(offers.price).toBe('25.00');
    expect(offers.priceCurrency).toBe('USD');
  });
  it('includes endDate + description when provided', () => {
    const j = buildEventJsonLd({ title: 'X', slug: 'x', startsAt: '2026-08-01T18:00:00Z', endsAt: '2026-08-01T20:00:00Z', description: 'Hi' });
    expect(j.endDate).toBe('2026-08-01T20:00:00Z');
    expect(j.description).toBe('Hi');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('numbers items from 1 with absolute urls', () => {
    const j = buildBreadcrumbJsonLd([{ name: 'Events', path: '/events' }, { name: 'Gala', path: '/events/gala' }]);
    const items = j.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0].position).toBe(1);
    expect(items[1].item).toBe('https://www.charitme.com/events/gala');
  });
});

describe('buildItemListJsonLd', () => {
  it('counts and positions entries', () => {
    const j = buildItemListJsonLd('Events', [{ name: 'A', path: '/events/a' }, { name: 'B', path: '/events/b' }]);
    expect(j.numberOfItems).toBe(2);
    expect((j.itemListElement as Array<Record<string, unknown>>)[1].position).toBe(2);
  });
});

describe('jsonLdScript', () => {
  it('escapes < to prevent script breakout', () => {
    const s = jsonLdScript({ x: '</script><b>' });
    expect(s).not.toContain('</script>');
    expect(s).toContain('\\u003c');
  });
});
