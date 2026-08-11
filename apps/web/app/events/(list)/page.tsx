import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '../../../components/ui';
import CampaignImage from '../../../components/CampaignImage';
import {
  ReferenceCta,
  ReferenceHero,
  ReferenceIconGrid,
  ReferencePage,
  ReferenceSection,
  ReferenceStats,
} from '../../../components/ReferenceMarketing';
import { listPublishedEvents } from '../../../lib/events';
import { getCause } from '../../../lib/causes';
import { remainingCapacity } from '../../../lib/events-core';
import { getDistinctDisplayPhotos } from '../../../lib/photo-catalog';

export const metadata: Metadata = {
  title: 'Events - Gather for Good',
  description: 'Discover upcoming fundraising events, community gatherings, galas, and virtual events on CharitMe, then RSVP in one click.',
  alternates: { canonical: 'https://www.charitme.com/events' },
};

export const dynamic = 'force-dynamic';

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const EVENT_BENEFITS = [
  { icon: 'people', title: 'Meet Your Community', body: 'Gather with people who care about the same causes.' },
  { icon: 'heart', title: 'Support a Mission', body: 'Every registration and share helps a campaign move.' },
  { icon: 'calendar', title: 'Join Your Way', body: 'Choose local, hybrid, or fully virtual experiences.' },
  { icon: 'megaphone', title: 'Host an Event', body: 'Create an event and manage registrations from your dashboard.' },
];

export default async function EventsPage({ searchParams }: { searchParams?: Promise<{ cause?: string; q?: string; type?: string; location?: string }> }) {
  const sp = (await searchParams) ?? {};
  const cause = typeof sp.cause === 'string' ? getCause(sp.cause) : undefined;
  const query = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : '';
  const eventType = typeof sp.type === 'string' ? sp.type : '';
  const location = typeof sp.location === 'string' ? sp.location : '';
  const allEvents = await listPublishedEvents(60, cause?.categories);
  const eventTypes = [...new Set(allEvents.map((event) => event.event_type))].sort();
  const locations = [...new Set(allEvents.map((event) => event.location).filter((value): value is string => Boolean(value)))].sort();
  const events = allEvents.filter((event) => {
    if (eventType && event.event_type !== eventType) return false;
    if (location && event.location !== location) return false;
    if (!query) return true;
    return `${event.title} ${event.description ?? ''} ${event.location ?? ''}`.toLowerCase().includes(query);
  });
  const virtualCount = allEvents.filter((event) => Boolean(event.virtual_url)).length;
  const photos = getDistinctDisplayPhotos(events.map((event) => ({
    category: 'Event',
    key: event.slug,
    storedCover: event.cover_image_url,
    pageScope: 'events-list',
  })));

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Get Involved', href: '/get-involved' }, { label: 'Events' }]}
        eyebrow="Events"
        title={<>Come Together.<br /><span className="rp-accent">Create Change.</span></>}
        lede="Discover impactful events in your community and around the world. Whether you want to attend, volunteer, or host your own, every event brings us closer to a better tomorrow."
        search={{ action: '/events', placeholder: 'Search events, causes, or locations...', defaultValue: sp.q }}
        image="/images/reference/events-hero.jpg"
        imageAlt="People gathering at a community fundraising event"
        callout={{ icon: 'heart', title: 'Your presence matters.', body: 'Find events that inspire you and help make a difference in your community and beyond.' }}
        variant="catalog"
      />

      <ReferenceStats items={[
        { icon: 'calendar', value: allEvents.length.toLocaleString(), label: 'Upcoming events shown' },
        { icon: 'globe', value: virtualCount.toLocaleString(), label: 'Virtual events shown' },
        { icon: 'location', value: locations.length.toLocaleString(), label: 'Locations represented' },
        { icon: 'tag', value: eventTypes.length.toLocaleString(), label: 'Event types available' },
      ]} />

      <div id="events">
        <ReferenceSection title={cause ? `${cause.label} Events` : 'Upcoming Events'} intro="Search and filter live events, then open an event to RSVP.">
          <form className="rp-filters" method="GET" action="/events" role="search">
            {cause && <input type="hidden" name="cause" value={cause.slug} />}
            <label><span>Search</span><input name="q" defaultValue={sp.q} placeholder="Search events" /></label>
            <label><span>Type</span><select name="type" defaultValue={eventType}><option value="">All types</option>{eventTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></label>
            <label><span>Location</span><select name="location" defaultValue={location}><option value="">All locations</option>{locations.map((place) => <option key={place} value={place}>{place}</option>)}</select></label>
            <button type="submit">Apply Filters</button>
            {(query || eventType || location) && <Link href={cause ? `/events?cause=${cause.slug}` : '/events'}>Clear</Link>}
          </form>

          {events.length === 0 ? (
            <EmptyState icon="♡" title="No events match those filters" body="Try a broader search or clear the filters to see every upcoming event." action={<Link href={cause ? `/events?cause=${cause.slug}` : '/events'} className="rp-text-link">Clear filters</Link>} />
          ) : (
            <div className="rp-live-grid rp-live-grid-events">
              {events.map((event, index) => {
                const remaining = remainingCapacity(event.capacity, event.registered_qty);
                const full = Number.isFinite(remaining) && remaining <= 0;
                return (
                  <article className="rp-live-card" key={event.id}>
                    <Link href={`/events/${event.slug}`} className="rp-live-media"><CampaignImage src={photos[index]} category="Event" campaignKey={event.slug} alt="" width={520} height={300} loading="lazy" allowGeneratedFallback /></Link>
                    <div className="rp-live-body">
                      <div className="rp-live-tags"><span>{event.event_type.replaceAll('_', ' ')}</span>{event.virtual_url && <span>Virtual</span>}{full && <span>Full</span>}</div>
                      <h3><Link href={`/events/${event.slug}`}>{event.title}</Link></h3>
                      <p>{dateLabel(event.starts_at)}{event.location ? ` · ${event.location}` : ''}</p>
                      {event.description && <div className="rp-live-copy">{event.description}</div>}
                      <Link className="rp-text-link" href={`/events/${event.slug}`}>{full ? 'View event' : 'View details and RSVP'}</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </ReferenceSection>
      </div>

      <ReferenceSection title="Why Join a CharitMe Event">
        <ReferenceIconGrid items={EVENT_BENEFITS} columns={4} />
      </ReferenceSection>

      <ReferenceCta
        icon="calendar"
        title="Bring People Together for a Cause"
        body="Create an event, invite your community, and manage every registration from CharitMe."
        actions={[
          { label: 'Host an Event', href: '/events/manage' },
          { label: 'Browse Campaigns', href: '/campaigns', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
