import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section } from '../../../components/PageShell';
import { getGivingDay } from '../../../lib/giving-days-server';
import { givingDayProgress, givingDayCountdown, formatCountdown } from '../../../lib/giving-days-core';
import { formatCents } from '../../../lib/stripe';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const day = await getGivingDay(slug);
  if (!day) return { title: 'Giving day not found' };
  return {
    title: day.title,
    description: day.nonprofitName
      ? `${day.title} — a giving day by ${day.nonprofitName} on CharitMe.`
      : `${day.title} — a giving day on CharitMe.`,
    alternates: { canonical: `https://www.charitme.com/giving-days/${day.slug}` },
  };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unavailable';
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

export default async function GivingDayPage({ params }: Props) {
  const { slug } = await params;
  const day = await getGivingDay(slug);
  if (!day) notFound();

  const pct = givingDayProgress(day.raisedCents, day.goal_amount);
  // Structured, not a sentence — see givingDayCountdown. It is null unless the
  // event is live, so the countdown cannot appear beside "Ended".
  const countdown = givingDayCountdown({ startsAt: day.starts_at, endsAt: day.ends_at });

  return (
    <PageBody>
      <PageHero
        eyebrow={day.phase === 'live' ? 'LIVE NOW' : day.phase === 'upcoming' ? 'UPCOMING' : 'ENDED'}
        title={day.title}
        lede={
          day.nonprofitName
            ? `A giving day by ${day.nonprofitName}.`
            : 'A giving day on CharitMe.'
        }
        actions={
          // Only a LIVE day gets a donate call to action. Offering one on an
          // event that has not opened or has closed sends the visitor to a
          // decision the page has just told them they cannot make.
          day.phase === 'live' ? (
            <Link href="/campaigns" className="cta-primary" style={{ display: 'inline-flex' }}>
              Give now
            </Link>
          ) : undefined
        }
      />

      <Section id="progress" heading="Where it stands">
        <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>
          {formatCents(day.raisedCents)} raised
          {pct !== null && (
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--t3)' }}>
              {' '}· {pct}% of {formatCents(day.goal_amount ?? 0)}
            </span>
          )}
        </p>
        {pct !== null && (
          <span style={{ display: 'block', maxWidth: 620, height: 8, borderRadius: 999, background: 'var(--s3)', overflow: 'hidden', margin: '10px 0 14px' }}>
            <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: 'var(--green)' }} />
          </span>
        )}
        {pct === null && (
          <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: '0 0 14px' }}>
            {/* Said plainly rather than drawn as an empty bar. */}
            No goal was set for this giving day.
          </p>
        )}
        <p style={{ fontSize: 14, color: 'var(--t2)', margin: 0 }}>
          {countdown && <strong>{formatCountdown(countdown)} left. </strong>}
          Opens {formatDateTime(day.starts_at)} and closes {formatDateTime(day.ends_at)}.
        </p>
      </Section>

      <Section id="what-counts" heading="What counts toward the total">
        <p style={{ maxWidth: 720, fontSize: '15px', lineHeight: 1.7, color: 'var(--t2)' }}>
          Every completed donation to {day.nonprofitName ?? 'this organisation'}&rsquo;s
          campaigns inside the window above. There is no separate giving-day
          checkout and no separate pot: you give to a campaign exactly as you
          normally would, and it counts here because of when it happened.
        </p>
        <p style={{ maxWidth: 720, fontSize: '15px', lineHeight: 1.7, color: 'var(--t2)' }}>
          {day.nonprofitSlug ? (
            <Link href={`/campaigns?q=${encodeURIComponent(day.nonprofitName ?? '')}`}>
              Find this organisation&rsquo;s campaigns
            </Link>
          ) : (
            <Link href="/campaigns">Browse campaigns</Link>
          )}
          {' · '}
          <Link href="/giving-days">All giving days</Link>
        </p>
      </Section>
    </PageBody>
  );
}
