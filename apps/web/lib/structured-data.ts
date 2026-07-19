// Pure builders for schema.org JSON-LD (SEO / AEO rich results).
// No Supabase/Next imports — unit-testable. Consumers inject the returned object
// into a <script type="application/ld+json"> tag.

const SITE = 'https://www.charitme.com';
const ORG = { '@type': 'Organization', name: 'CharitMe', url: SITE } as const;

export interface EventJsonLdInput {
  title: string;
  description?: string | null;
  slug: string;
  startsAt: string; // ISO
  endsAt?: string | null;
  location?: string | null;
  virtualUrl?: string | null;
  /** Cheapest ticket price in cents, or 0/undefined for free. */
  lowPriceCents?: number | null;
  currency?: string | null;
  isFree?: boolean;
}

/** Builds a schema.org Event object for an event detail page. */
export function buildEventJsonLd(e: EventJsonLdInput): Record<string, unknown> {
  const online = !!e.virtualUrl;
  const url = `${SITE}/events/${e.slug}`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: e.startsAt,
    eventAttendanceMode: online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: ORG,
    url,
  };

  if (e.description) jsonLd.description = e.description;
  if (e.endsAt) jsonLd.endDate = e.endsAt;

  jsonLd.location = online
    ? { '@type': 'VirtualLocation', url: e.virtualUrl }
    : { '@type': 'Place', name: e.location || 'In-person event', address: e.location || undefined };

  const free = e.isFree || !e.lowPriceCents || e.lowPriceCents <= 0;
  jsonLd.isAccessibleForFree = free;
  jsonLd.offers = {
    '@type': 'Offer',
    price: free ? '0' : (e.lowPriceCents! / 100).toFixed(2),
    priceCurrency: (e.currency || 'USD').toUpperCase(),
    availability: 'https://schema.org/InStock',
    url,
  };

  return jsonLd;
}

export interface BreadcrumbItem {
  name: string;
  path: string; // e.g. "/events/foo" or "/events"
}

/** Builds a BreadcrumbList for nested public pages. */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE}${it.path}`,
    })),
  };
}

export interface ItemListEntry {
  name: string;
  path: string;
}

/** Builds an ItemList for a discovery/listing page (events, sponsorships). */
export function buildItemListJsonLd(name: string, entries: ItemListEntry[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.name,
      url: `${SITE}${e.path}`,
    })),
  };
}

/** Serializes JSON-LD safely for embedding in a <script> tag (escapes `<`). */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
