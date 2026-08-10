import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { getCause } from '../../lib/causes';
import { boundedQuery } from '../../lib/query-timeout';
import { formatCents } from '../../lib/stripe';
import { EmptyState } from '../../components/ui';
import CampaignImage from '../../components/CampaignImage';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferenceIconGrid,
  ReferencePage,
  ReferenceSection,
  ReferenceStats,
  ReferenceSteps,
} from '../../components/ReferenceMarketing';
import { getPhotosForPage } from '../../lib/photo-catalog';

export const metadata: Metadata = {
  title: 'Team Fundraising',
  description: 'Start or join a CharitMe fundraising team, rally your people around one goal, and track shared progress together.',
  alternates: { canonical: 'https://www.charitme.com/teams' },
};

export const revalidate = 300;

type TeamRow = {
  id: string;
  slug: string;
  title: string;
  goal_amount: number;
  raised_amount: number | null;
  parent_campaign_id: string;
  campaigns?: { title: string; slug: string } | { title: string; slug: string }[] | null;
};

type TeamsData = {
  teams: TeamRow[];
  totalTeams: number | null;
  totalRaisedCents: number | null;
};

async function getTeams(categories?: readonly string[]): Promise<TeamsData | null> {
  const scoped = Boolean(categories?.length);
  try {
    const listQuery = supabaseAdmin.from('peer_fundraisers').select(
      scoped
        ? 'id, slug, title, goal_amount, raised_amount, parent_campaign_id, campaigns:parent_campaign_id!inner(title, slug, category)'
        : 'id, slug, title, goal_amount, raised_amount, parent_campaign_id, campaigns:parent_campaign_id(title, slug)',
    ).eq('status', 'active');

    const [listRes, countRes, sumRes] = await Promise.all([
      boundedQuery(() => (scoped ? listQuery.in('campaigns.category', categories as string[]) : listQuery).order('raised_amount', { ascending: false }).limit(12)),
      boundedQuery(() => supabaseAdmin.from('peer_fundraisers').select('id', { count: 'exact', head: true }).eq('status', 'active')),
      boundedQuery(() => supabaseAdmin.from('peer_fundraisers').select('raised_amount').eq('status', 'active').limit(5000)),
    ]);

    if (listRes.error) return null;
    const sumRows = (sumRes.data ?? []) as { raised_amount: number | null }[];
    return {
      teams: (listRes.data ?? []) as unknown as TeamRow[],
      totalTeams: countRes.error ? null : countRes.count ?? 0,
      totalRaisedCents: sumRes.error ? null : sumRows.reduce((sum, row) => sum + (row.raised_amount ?? 0), 0),
    };
  } catch {
    return null;
  }
}

function parentOf(team: TeamRow): { title: string; slug: string } | null {
  if (!team.campaigns) return null;
  return Array.isArray(team.campaigns) ? team.campaigns[0] ?? null : team.campaigns;
}

const BENEFITS = [
  { icon: 'people', title: 'Raise More', body: 'Teams raise more than individuals by combining their reach.' },
  { icon: 'heart', title: 'Build Community', body: 'Bring people together around a shared cause.' },
  { icon: 'share', title: 'Friendly Competition', body: 'Leaderboards and challenges keep teams motivated.' },
  { icon: 'award', title: 'Make a Real Difference', body: 'Every dollar brings your team closer to the goal.' },
];

const STEPS = [
  { icon: 'people', title: 'Create Your Team', body: 'Set a goal, tell your story, and create your team in minutes.' },
  { icon: 'mail', title: 'Invite Your Team', body: 'Invite friends, family, colleagues, or classmates to join.' },
  { icon: 'megaphone', title: 'Share & Fundraise', body: 'Spread the word and inspire donations together.' },
  { icon: 'award', title: 'Track & Compete', body: 'Watch progress, climb the leaderboard, and unlock badges.' },
  { icon: 'heart', title: 'Make an Impact', body: 'Reach your goal and create lasting change together.' },
];

export default async function TeamsPage({ searchParams }: { searchParams?: Promise<{ cause?: string }> }) {
  const sp = (await searchParams) ?? {};
  const cause = typeof sp.cause === 'string' ? getCause(sp.cause) : undefined;
  const data = await getTeams(cause?.categories);
  const photos = getPhotosForPage('Community', 'teams', 14);

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Get Involved', href: '/get-involved' }, { label: 'Team Fundraising' }]}
        eyebrow="Team Fundraising"
        title={<>Stronger Together.<br /><span className="rp-accent">Greater Impact.</span></>}
        lede="Rally your team, inspire your community, and reach your goals faster. Team fundraising makes it easy to collaborate, compete, and create lasting change together."
        actions={[
          { label: 'Start a Team Fundraiser', href: '/create' },
          { label: 'Watch How It Works', href: '/how-it-works', variant: 'secondary' },
        ]}
        image="/images/reference/teams-hero.jpg"
        imageAlt="A fundraising team celebrating together"
      />

      <ReferenceSection title="Why Fundraise as a Team" intro="A shared goal turns individual effort into visible momentum.">
        <ReferenceIconGrid items={BENEFITS} columns={4} />
      </ReferenceSection>

      <ReferenceSection title="How Team Fundraising Works" intro="It is simple to create a team, invite others, and start raising money for what matters most.">
        <ReferenceSteps items={STEPS} />
      </ReferenceSection>

      <ReferenceStats items={[
        { icon: 'users', value: data?.totalTeams != null ? data.totalTeams.toLocaleString() : '—', label: 'Active teams' },
        { icon: 'dollar', value: data?.totalRaisedCents != null ? formatCents(data.totalRaisedCents, 'usd') : '—', label: 'Raised by teams' },
        { icon: 'heart', value: data ? data.teams.length.toLocaleString() : '—', label: 'Teams shown here' },
        { icon: 'target', value: cause?.label ?? 'All', label: 'Cause filter' },
      ]} />

      <ReferenceSection title={cause ? `${cause.label} Teams` : 'Top Team Fundraisers'} intro="Active teams ordered by the amount they have raised.">
        {data === null ? (
          <EmptyState icon="!" title="We couldn't load teams just now" body="This is a temporary data problem, not an empty team list." action={<Link href="/teams" className="rp-text-link">Try again</Link>} />
        ) : data.teams.length === 0 ? (
          <EmptyState icon="♡" title="No active teams right now" body="Start the first team and invite people to raise alongside you." action={<Link href="/campaigns" className="rp-text-link">Find a campaign</Link>} />
        ) : (
          <div className="rp-live-grid">
            {data.teams.map((team, index) => {
              const parent = parentOf(team);
              const raised = team.raised_amount ?? 0;
              return (
                <article className="rp-live-card" key={team.id}>
                  <CampaignImage src={photos[index + 1] ?? photos[0]} category="Community" campaignKey={team.slug} alt="" width={520} height={300} loading="lazy" />
                  <div className="rp-live-body">
                    <h3>{team.title}</h3>
                    {parent && <p>Raising for <Link href={`/campaigns/${parent.slug}`}>{parent.title}</Link></p>}
                    <progress value={raised} max={Math.max(team.goal_amount, 1)} aria-label={`${formatCents(raised, 'usd')} of ${formatCents(team.goal_amount, 'usd')} raised`} />
                    <div><strong>{formatCents(raised, 'usd')}</strong><span>of {formatCents(team.goal_amount, 'usd')}</span></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ReferenceSection>

      <ReferenceSection title="Build a Team People Want to Join">
        <ReferenceCardGrid items={[
          { icon: 'target', title: 'Use One Clear Goal', body: 'Explain the result your team is trying to unlock.', action: 'Campaign planning', href: '/fundraising-guide' },
          { icon: 'megaphone', title: 'Give Members a Message', body: 'Make the first share personal and easy to adapt.', action: 'Story guidance', href: '/blog' },
          { icon: 'refresh', title: 'Celebrate Progress', body: 'Share milestones so members and donors can see movement.', action: 'Growth ideas', href: '/resources' },
        ]} columns={3} />
      </ReferenceSection>

      <ReferenceCta
        icon="people"
        title="Ready to Rally Your Team?"
        body="Choose a campaign, set a shared goal, and invite your people to take part."
        actions={[
          { label: 'Start a Team', href: '/create' },
          { label: 'Browse Campaigns', href: '/campaigns', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
