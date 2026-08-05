import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, EmptyState } from '../../../components/ui';
import { listPublishedEvents } from '../../../lib/events';
import { getCause } from '../../../lib/causes';
import { remainingCapacity } from '../../../lib/events-core';

export const metadata: Metadata = {
  title: 'Events — Fundraising Events & Galas',
  description: 'Discover upcoming fundraising events, galas, and giving days on CharitMe. RSVP in one click.',
  alternates: { canonical: 'https://www.charitme.com/events' },
};
export const dynamic = 'force-dynamic';

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ cause?: string }>;
}) {
  // `?cause=` scopes the list to one cause's campaign categories, which is how
  // a cause hub links to "its" events without a second page that would drift.
  // An unknown slug is ignored rather than 404'd — a stale link should still
  // land on the full list.
  const sp = (await searchParams) ?? {};
  const cause = typeof sp.cause === 'string' ? getCause(sp.cause) : undefined;
  const events = await listPublishedEvents(60, cause?.categories);

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        {cause && (
          <nav aria-label="Breadcrumb" style={{ marginBottom: 10 }}>
            <Link href={`/causes/${cause.slug}`} style={{ fontSize: 13, fontWeight: 650, color: 'var(--t3)' }}>
              ← {cause.label}
            </Link>
          </nav>
        )}
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          📅 {cause ? `${cause.label} events` : 'Events'}
        </h1>
        <p style={{ color: 'var(--t3)', fontSize: 15, maxWidth: 640 }}>
          Upcoming fundraising events, galas, and giving days. RSVP in one click — organizers can
          host an event and check attendees in from their dashboard.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon="📅"
          title={cause ? `No upcoming ${cause.label} events` : 'No upcoming events yet'}
          body={
            cause
              ? 'Nothing scheduled under this cause right now. Browse every upcoming event instead.'
              : 'Check back soon, or host the first event from the manage page.'
          }
          // ⚠️ The UNFILTERED case used to pass `undefined` here, so the more
          // common empty state offered no action at all — and the body told the
          // visitor to "host the first event from the manage page" without ever
          // linking to it. Measured: 0 links inside <main> on this route.
          action={
            cause ? (
              <Link className="cta-primary" href="/events" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 'var(--r)', textDecoration: 'none', fontWeight: 700 }}>All events</Link>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                <Link className="cta-primary" href="/events/manage" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 'var(--r)', textDecoration: 'none', fontWeight: 700 }}>Host an event</Link>
                <Link className="vol-btn-secondary" href="/campaigns">Browse campaigns</Link>
              </div>
            )
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 18 }}>
          {events.map((e) => {
            const remaining = remainingCapacity(e.capacity, e.registered_qty);
            const full = Number.isFinite(remaining) && remaining <= 0;
            return (
              <Link
                key={e.id}
                href={`/events/${e.slug}`}
                style={{ display: 'block', border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 18, background: 'var(--s1)', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <Badge color="blue">{e.event_type.replace('_', ' ')}</Badge>
                  {e.virtual_url ? <Badge color="green">Virtual</Badge> : e.location ? <Badge color="gray">{e.location}</Badge> : null}
                  {full ? <Badge color="red">Full</Badge> : Number.isFinite(remaining) ? <Badge color="green">{remaining} spots left</Badge> : null}
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{e.title}</h2>
                <div style={{ fontSize: 13, color: 'var(--t4)', marginBottom: 8 }}>{dateLabel(e.starts_at)}</div>
                {e.description && (
                  <p style={{ color: 'var(--t3)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                    {e.description.length > 130 ? `${e.description.slice(0, 130)}…` : e.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
