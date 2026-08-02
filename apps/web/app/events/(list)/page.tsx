import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, EmptyState } from '../../../components/ui';
import { listPublishedEvents } from '../../../lib/events';
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

export default async function EventsPage() {
  const events = await listPublishedEvents(60);

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>📅 Events</h1>
        <p style={{ color: 'var(--t3)', fontSize: 15, maxWidth: 640 }}>
          Upcoming fundraising events, galas, and giving days. RSVP in one click — organizers can
          host an event and check attendees in from their dashboard.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState icon="📅" title="No upcoming events yet" body="Check back soon, or host the first event from the manage page." />
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
