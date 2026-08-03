import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { getCause } from '../../lib/causes';
import { boundedQuery } from '../../lib/query-timeout';
import { formatCents } from '../../lib/stripe';
import { ProgressBar, EmptyState } from '../../components/ui';
import { PageBody, PageHero, Section, CardGrid, InfoCard, StatCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Teams',
  description:
    'Fundraise together. Start or join a team on CharitMe, rally your friends and colleagues, and track a shared goal.',
  alternates: { canonical: 'https://www.charitme.com/teams' },
};

export const revalidate = 300;

interface TeamRow {
  id: string;
  slug: string;
  title: string;
  goal_amount: number;
  raised_amount: number | null;
  parent_campaign_id: string;
  campaigns?: { title: string; slug: string } | { title: string; slug: string }[] | null;
}

interface TeamsData {
  teams: TeamRow[];
  /** `null` when a figure could not be measured — never coerced to 0. */
  totalTeams: number | null;
  totalRaisedCents: number | null;
}

/**
 * Teams are `peer_fundraisers` — the peer-to-peer table that already backs team
 * fundraising on campaign pages. This page is a public index over it rather than
 * a new concept with new tables.
 *
 * The design mockup shows "12,840 Teams Created", "245K+ Team Members" and
 * "$98M+ Raised by Teams". Those are illustrative and are NOT reproduced: every
 * figure here is counted, and anything that cannot be counted renders as an
 * em-dash rather than a plausible number.
 */
/**
 * `categories` scopes the LIST to one cause. `peer_fundraisers` has no category
 * of its own, so the filter reaches through `parent_campaign_id` — which is NOT
 * NULL, so unlike events no team is dropped by the join.
 *
 * The headline count and total stay platform-wide on purpose: they are labelled
 * as platform totals, and silently reinterpreting them as cause totals is the
 * kind of quiet mislabel this repo keeps finding.
 */
async function getTeams(categories?: readonly string[]): Promise<TeamsData | null> {
  const scoped = categories && categories.length > 0;
  try {
    const listQuery = supabaseAdmin
      .from('peer_fundraisers')
      .select(
        scoped
          ? 'id, slug, title, goal_amount, raised_amount, parent_campaign_id, campaigns:parent_campaign_id!inner(title, slug, category)'
          : 'id, slug, title, goal_amount, raised_amount, parent_campaign_id, campaigns:parent_campaign_id(title, slug)',
      )
      .eq('status', 'active');

    // Bounded like every other discovery read: a stalled database held this page
    // for ~7s with no ceiling. A timeout yields `{ data: null, error }`, which
    // the `null` return below already renders as "could not load", not "none".
    const [listRes, countRes, sumRes] = await Promise.all([
      boundedQuery(() =>
        (scoped ? listQuery.in('campaigns.category', categories as string[]) : listQuery)
          .order('raised_amount', { ascending: false })
          .limit(12),
      ),
      boundedQuery(() =>
        supabaseAdmin
          .from('peer_fundraisers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
      ),
      // Bounded: the sum is over active teams only and capped. A full-table
      // scan here is what `__tests__/unbounded-reads.test.ts` exists to stop.
      boundedQuery(() =>
        supabaseAdmin
        .from('peer_fundraisers')
        .select('raised_amount')
        .eq('status', 'active')
        .limit(5000),
      ),
    ]);

    if (listRes.error) return null;

    const sumRows = (sumRes.data ?? []) as { raised_amount: number | null }[];
    return {
      teams: (listRes.data ?? []) as unknown as TeamRow[],
      totalTeams: countRes.error ? null : countRes.count ?? 0,
      totalRaisedCents: sumRes.error
        ? null
        : sumRows.reduce((sum, r) => sum + (r.raised_amount ?? 0), 0),
    };
  } catch {
    return null;
  }
}

function parentOf(t: TeamRow): { title: string; slug: string } | null {
  const c = t.campaigns;
  if (!c) return null;
  return Array.isArray(c) ? c[0] ?? null : c;
}

const WHAT_IS_A_TEAM = [
  { title: 'Share a common goal', body: 'Everyone on the team raises toward one target, so progress is visible to all of you at once.' },
  { title: 'Invite friends and family', body: 'Each member gets their own page and link, and everything they raise counts toward the team total.' },
  { title: 'Track progress together', body: 'See who has joined, what each member has raised, and how close the team is to its goal.' },
];

export default async function TeamsPage({
  searchParams,
}: {
  searchParams?: Promise<{ cause?: string }>;
}) {
  // `?cause=` scopes the team list to one cause. An unknown slug falls through
  // to the full list rather than 404ing, so a stale link still lands somewhere.
  const sp = (await searchParams) ?? {};
  const cause = typeof sp.cause === 'string' ? getCause(sp.cause) : undefined;
  const data = await getTeams(cause?.categories);
  const dash = '—';

  return (
    <PageBody>
      <PageHero
        eyebrow="TEAMS"
        title="Stronger together"
        lede="Create or join a team to amplify your impact. Everyone raises toward one shared goal, with their own page and their own link."
        actions={
          <>
            <Link href="/create" className="cta-primary" style={{ display: 'inline-flex' }}>
              Start a team
            </Link>
            <Link
              href="/campaigns"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Find a campaign to join
            </Link>
          </>
        }
      />

      <Section
        id="stats"
        heading="Teams on CharitMe"
        intro={
          data === null
            ? 'These figures are temporarily unavailable. A dash means we could not measure the value — it does not mean it is zero.'
            : 'Counted from active teams, refreshed at most every five minutes.'
        }
      >
        <CardGrid min={200}>
          <StatCard
            value={data?.totalTeams != null ? data.totalTeams.toLocaleString() : dash}
            label="Active teams"
          />
          <StatCard
            value={data?.totalRaisedCents != null ? formatCents(data.totalRaisedCents, 'usd') : dash}
            label="Raised by teams"
          />
          {/* Deliberately absent: the mockup's "Team Members" figure. There is no
              membership count on `peer_fundraisers`, so any number here would be
              invented. Better a missing tile than a fabricated one. */}
        </CardGrid>
      </Section>

      <Section id="teams" heading="Active teams" intro="Teams currently raising toward a shared goal.">
        {data === null ? (
          <EmptyState
            icon="⚠️"
            title="We couldn't load teams just now"
            body="This is a problem on our side, not an empty list. Please refresh in a moment."
            action={<Link href="/teams" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
          />
        ) : data.teams.length === 0 ? (
          <EmptyState
            icon="🤝"
            title="No teams are running right now"
            body="Be the first — start a team on any campaign and invite people to raise alongside you."
            action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse campaigns</Link>}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '18px' }}>
            {data.teams.map((team) => {
              const parent = parentOf(team);
              const raised = team.raised_amount ?? 0;
              return (
                <div
                  key={team.id}
                  style={{ padding: '20px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--t1)', lineHeight: 1.3 }}>
                    {team.title}
                  </h3>
                  {parent && (
                    <p style={{ fontSize: '13px', color: 'var(--t3)' }}>
                      Raising for{' '}
                      <Link href={`/campaigns/${parent.slug}`} style={{ color: 'var(--green-text)', fontWeight: 650 }}>
                        {parent.title}
                      </Link>
                    </p>
                  )}
                  <ProgressBar value={raised} max={team.goal_amount} />
                  <div style={{ fontSize: '13px', color: 'var(--t3)' }}>
                    <strong style={{ color: 'var(--green-text)' }}>{formatCents(raised, 'usd')}</strong>{' '}
                    of {formatCents(team.goal_amount, 'usd')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section id="what" heading="What is a team?" intro="Three things a team gives you that a solo campaign does not.">
        <CardGrid min={260}>
          {WHAT_IS_A_TEAM.map((w) => <InfoCard key={w.title} title={w.title} body={w.body} />)}
        </CardGrid>
      </Section>

      <CtaBand
        heading="Rally your people"
        body="Start a team on any campaign, invite members, and raise toward one goal together."
        primary={{ label: 'Start a team', href: '/create' }}
        secondary={{ label: 'How it works', href: '/how-it-works' }}
      />
    </PageBody>
  );
}
