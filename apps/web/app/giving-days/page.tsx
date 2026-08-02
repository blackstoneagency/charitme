import 'server-only';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section } from '../../components/PageShell';
import { EmptyState } from '../../components/ui';
import { listGivingDays } from '../../lib/giving-days-server';
import { givingDayProgress } from '../../lib/giving-days-core';
import { formatCents } from '../../lib/stripe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Giving Days',
  description:
    'Time-boxed fundraising events on CharitMe — what is running now, what is coming, and how much each has raised.',
  alternates: { canonical: 'https://www.charitme.com/giving-days' },
};

// The public reader for `giving_days`, which shipped with RLS, a unique slug and
// a foreign key — and nothing in the product that read or wrote it.
//
// Ordering is by phase (live, then upcoming, then ended), not by date: someone
// arriving here wants to know what they can give to right now, and a strict
// date sort buries a live event under next quarter's announcements.

const PHASE_LABEL = { live: 'Live now', upcoming: 'Upcoming', ended: 'Ended' } as const;
const PHASE_TONE = {
  live: { bg: 'var(--green-light)', fg: 'var(--green-text)' },
  upcoming: { bg: 'var(--s2)', fg: 'var(--t2)' },
  ended: { bg: 'var(--s2)', fg: 'var(--t3)' },
} as const;

function formatWindow(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Dates unavailable';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

export default async function GivingDaysPage() {
  const days = await listGivingDays();

  return (
    <PageBody>
      <PageHero
        eyebrow="GIVING DAYS"
        title="A day when everyone gives at once"
        lede="A giving day is a fixed window — often 24 hours — when a nonprofit asks its whole community to give together. Momentum is the point: people give more readily when they can see it happening."
      />

      <Section id="days" heading="Giving days on CharitMe">
        {days === null ? (
          <EmptyState
            icon="⚠️"
            title="Giving days are unavailable right now"
            body="We could not reach the database. This is us, not you — try again in a moment."
            action={<Link href="/giving-days" style={{ fontWeight: 650, color: 'var(--green-text)' }}>Try again</Link>}
          />
        ) : days.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No giving days are scheduled"
            body="Nothing is running right now. Browse campaigns in the meantime — every one of them takes donations today."
            action={<Link href="/campaigns" style={{ fontWeight: 650, color: 'var(--green-text)' }}>Browse campaigns</Link>}
          />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
            {days.map((day) => {
              const pct = givingDayProgress(day.raisedCents, day.goal_amount);
              const tone = PHASE_TONE[day.phase];
              return (
                <li key={day.id} style={{ minWidth: 0 }}>
                  <Link
                    href={`/giving-days/${day.slug}`}
                    style={{
                      display: 'block', padding: 18, minWidth: 0,
                      border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
                      background: 'var(--s1)', textDecoration: 'none',
                    }}
                  >
                    <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em',
                        padding: '3px 9px', borderRadius: 999, background: tone.bg, color: tone.fg,
                      }}>{PHASE_LABEL[day.phase]}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>{formatWindow(day.starts_at, day.ends_at)}</span>
                    </span>
                    <strong style={{ display: 'block', fontSize: 17, color: 'var(--t1)', marginBottom: 4 }}>{day.title}</strong>
                    {day.nonprofitName && (
                      <span style={{ display: 'block', fontSize: 13, color: 'var(--t3)', marginBottom: 10 }}>
                        by {day.nonprofitName}
                      </span>
                    )}
                    <span style={{ display: 'block', fontSize: 13.5, color: 'var(--t2)' }}>
                      <b style={{ color: 'var(--t1)' }}>{formatCents(day.raisedCents)}</b> raised
                      {/* A missing goal renders as nothing at all, not as 0%. A
                          bar at zero is a claim about the money; "no goal set"
                          is a different fact. */}
                      {pct !== null && <> · {pct}% of {formatCents(day.goal_amount ?? 0)}</>}
                    </span>
                    {pct !== null && (
                      <span style={{ display: 'block', height: 6, borderRadius: 999, background: 'var(--s3)', overflow: 'hidden', marginTop: 8 }}>
                        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--green)' }} />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="how" heading="How a giving day works">
        <p style={{ maxWidth: 720, fontSize: '15px', lineHeight: 1.7, color: 'var(--t2)' }}>
          The window is the whole mechanic. A campaign that runs for six months asks
          for a decision that can always be made tomorrow; a giving day asks for one
          that cannot. Everything raised through the nonprofit&rsquo;s campaigns
          during the window counts toward the total on this page.
        </p>
        <p style={{ maxWidth: 720, fontSize: '15px', lineHeight: 1.7, color: 'var(--t2)' }}>
          Nonprofits can schedule one from{' '}
          <Link href="/dashboard/giving-days">their dashboard</Link>. Donations go to
          the same campaigns as always — a giving day changes the timing and the
          story, not where the money lands.
        </p>
      </Section>
    </PageBody>
  );
}
