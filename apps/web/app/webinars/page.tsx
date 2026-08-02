import Link from 'next/link';
import type { Metadata } from 'next';
import { listPublishedEvents } from '../../lib/events';
import { EmptyState } from '../../components/ui';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Webinars & Online Events',
  description:
    'Live online sessions on fundraising strategy, storytelling, and running a campaign — register free for anything coming up.',
  alternates: { canonical: 'https://www.charitme.com/webinars' },
};

export const revalidate = 600;

// A webinar here is a REAL row, not a new concept: `fundraising_events` already
// carries `virtual_url` and an `event_type` that includes 'livestream'. So this
// page is the online slice of the events people are actually running, filtered
// from `listPublishedEvents()` — the same loader /events uses, so the two cannot
// disagree about what is scheduled.
//
// The design (76) shows speakers with photos and bios. There is no speakers
// table, so those are not invented; the page shows what each event actually
// records.

const LEARN_INSTEAD = [
  { title: 'Fundraising guide', body: 'The six steps to a funded campaign, in the order you take them.', href: '/fundraising-guide' },
  { title: 'Impact education', body: 'How giving works and how to read a campaign critically.', href: '/impact-education' },
  { title: 'Blog & insights', body: 'Strategy, product news, and donor research.', href: '/blog' },
  { title: 'All events', body: 'In-person fundraising events as well as online ones.', href: '/events' },
];

function formatWhen(iso: string): string {
  // Fixed locale + UTC so the server and client agree. Rendering a local-timezone
  // string from a Server Component produces a hydration mismatch and, worse,
  // shows a different start time than the one that was scheduled.
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }) + ' UTC';
}

/**
 * Online events, split into upcoming and past.
 *
 * The `Date.now()` lives HERE rather than in the component body: React's purity
 * rule forbids calling an impure function during render, and eslint enforces it.
 * A component that reads the clock mid-render can produce a different split on a
 * re-render than the one it committed.
 */
async function getWebinars() {
  // try/catch around the loader, not just around the query inside it:
  // `supabaseAdmin` THROWS ON CONSTRUCTION when its env vars are unset, and
  // `listPublishedEvents` does not catch that — so this page 500'd on a
  // credential-less build while every other page rendered its empty state.
  // Verified by reproducing the 500 locally, not inferred.
  let all: Awaited<ReturnType<typeof listPublishedEvents>> = [];
  try {
    all = await listPublishedEvents(120);
  } catch {
    return { upcoming: [], past: [] };
  }
  const now = Date.now();

  // Online = has a join URL, or is explicitly a livestream.
  const online = all.filter((e) => Boolean(e.virtual_url) || e.event_type === 'livestream');
  return {
    upcoming: online.filter((e) => new Date(e.starts_at).getTime() >= now),
    past: online
      .filter((e) => new Date(e.starts_at).getTime() < now)
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
      .slice(0, 6),
  };
}

export default async function WebinarsPage() {
  const { upcoming, past } = await getWebinars();

  return (
    <PageBody>
      <PageHero
        eyebrow="WEBINARS"
        title="Live online sessions"
        lede="Join a session from anywhere. Everything listed here is a real scheduled event — when nothing is scheduled, this page says so rather than showing placeholders."
        actions={
          <>
            <Link href="/events" className="cta-primary" style={{ display: 'inline-flex' }}>
              See all events
            </Link>
            <Link
              href="/fundraising-guide"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Read the guide instead
            </Link>
          </>
        }
      />

      <Section id="upcoming" heading="Upcoming sessions">
        {upcoming.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No online sessions are scheduled right now"
            body="Nothing is coming up. The guides below cover the same ground and are available immediately."
            action={<Link href="/fundraising-guide" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Read the fundraising guide</Link>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '14px' }}>
            {upcoming.map((e) => (
              <article
                key={e.id}
                style={{ padding: '20px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' }}
              >
                <h3 style={{ fontSize: '17px', fontWeight: 750, color: 'var(--t1)', lineHeight: 1.3 }}>
                  <Link href={`/events/${e.slug}`} style={{ color: 'var(--t1)', textDecoration: 'none' }}>
                    {e.title}
                  </Link>
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--t3)', fontWeight: 650 }}>{formatWhen(e.starts_at)}</p>
                {e.description && (
                  <p style={{ fontSize: '14px', color: 'var(--t3)', lineHeight: 1.6 }}>
                    {e.description.slice(0, 220)}{e.description.length > 220 ? '…' : ''}
                  </p>
                )}
                <p style={{ marginTop: '4px' }}>
                  <Link href={`/events/${e.slug}`} style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 700 }}>
                    Register free →
                  </Link>
                </p>
              </article>
            ))}
          </div>
        )}
      </Section>

      {past.length > 0 && (
        <Section id="past" heading="Recent sessions" intro="Already happened — the event pages stay up.">
          <CardGrid min={260}>
            {past.map((e) => (
              <InfoCard key={e.id} title={e.title} body={formatWhen(e.starts_at)} href={`/events/${e.slug}`} />
            ))}
          </CardGrid>
        </Section>
      )}

      <Section id="learn" heading="Available right now" intro="No waiting for a scheduled date.">
        <CardGrid min={250}>
          {LEARN_INSTEAD.map((l) => <InfoCard key={l.href} title={l.title} body={l.body} href={l.href} />)}
        </CardGrid>
      </Section>

      <CtaBand
        heading="Running a session yourself?"
        body="Create an online event on CharitMe and take registrations for it."
        primary={{ label: 'Create an event', href: '/events/manage' }}
        secondary={{ label: 'All events', href: '/events' }}
      />
    </PageBody>
  );
}
