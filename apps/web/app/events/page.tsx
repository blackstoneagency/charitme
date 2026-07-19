import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { Badge, Card, EmptyState } from '../../components/ui';
import { eventTypeLabel, isPast } from '../../lib/events';

export const metadata: Metadata = {
  title: 'Fundraising Events',
  description: 'Discover upcoming fundraising events, galas, giving days, and livestreams — and register to attend.',
  alternates: { canonical: 'https://www.charitme.com/events' },
};

export const dynamic = 'force-dynamic';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function EventsPage() {
  const { data } = await supabaseAdmin
    .from('fundraising_events')
    .select('id, title, slug, event_type, starts_at, ends_at, location, virtual_url, status')
    .eq('status', 'published')
    .order('starts_at', { ascending: true })
    .limit(100);

  const events = data ?? [];
  const upcoming = events.filter((e) => !isPast(e.starts_at, e.ends_at));
  const past = events.filter((e) => isPast(e.starts_at, e.ends_at));

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 20px 64px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--t1)', marginBottom: 8 }}>Fundraising events</h1>
        <p style={{ fontSize: 16, color: 'var(--t3)', maxWidth: 640 }}>
          Galas, giving days, livestreams, and community fundraisers. Register to attend and support the cause.
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState icon="🎟️" title="No events yet" body="No published events right now — check back soon." />
      ) : (
        <>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Upcoming</h2>
            {upcoming.length === 0 ? (
              <p style={{ color: 'var(--t3)', fontSize: 14 }}>No upcoming events right now.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {upcoming.map((e) => (
                  <Link key={e.id} href={`/events/${e.slug}`} style={{ textDecoration: 'none' }}>
                    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Badge color="blue">{eventTypeLabel(e.event_type)}</Badge>
                        {e.virtual_url && <Badge color="gray">Virtual</Badge>}
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{e.title}</h3>
                      <div style={{ fontSize: 13, color: 'var(--t3)' }}>{fmtDate(e.starts_at)}</div>
                      {e.location && <div style={{ fontSize: 13, color: 'var(--t3)' }}>📍 {e.location}</div>}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Past events</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {past.map((e) => (
                  <Link key={e.id} href={`/events/${e.slug}`} style={{ textDecoration: 'none' }}>
                    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', opacity: 0.75 }}>
                      <Badge color="gray">{eventTypeLabel(e.event_type)}</Badge>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{e.title}</h3>
                      <div style={{ fontSize: 13, color: 'var(--t3)' }}>{fmtDate(e.starts_at)}</div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
