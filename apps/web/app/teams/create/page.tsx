import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../../lib/campaign-visibility';
import CreateTeamWizard from './CreateTeamWizard';
import { EmptyState } from '../../../components/ui';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../../components/PageShell';

export const metadata: Metadata = {
  title: 'Create a Team',
  description:
    'Start a fundraising team on any CharitMe campaign — name it, set a goal, and share one link so supporters can raise alongside you.',
  alternates: { canonical: 'https://www.charitme.com/teams/create' },
};

export const revalidate = 300;

/** `null` on failure so the page can distinguish "we broke" from "nothing to join". */
async function getCampaigns(): Promise<{ id: string; slug: string; title: string }[] | null> {
  try {
    const cols = await campaignColumns();
    const { data, error } = await applyLiveFilters(
      supabaseAdmin.from('campaigns').select('id, slug, title'),
      cols,
    )
      .order('raised_amount', { ascending: false })
      .limit(100);

    if (error) return null;
    return (data ?? []) as { id: string; slug: string; title: string }[];
  } catch {
    return null;
  }
}

const TIPS = [
  { title: 'Name it after the group, not the cause', body: '“The Riverside Runners” gets shared more than “Clean Water Fund Team 3”. People give to people they recognise.' },
  { title: 'Set a goal you can explain', body: 'A number you can break down — “eight of us, $300 each” — raises more than a round figure.' },
  { title: 'Ask your closest circle first', body: 'A team page with early donations is far easier to share than an empty one.' },
];

export default async function CreateTeamPage() {
  const campaigns = await getCampaigns();

  return (
    <PageBody>
      <PageHero
        eyebrow="TEAMS"
        title="Create a team"
        lede="Pick a campaign, name your team, and set a goal. Everything your team raises counts toward the campaign’s total."
      />

      <Section id="wizard" heading="Set up your team">
        {campaigns === null ? (
          <EmptyState
            icon="⚠️"
            title="We couldn't load campaigns just now"
            body="This is a problem on our side. Please refresh in a moment."
            action={<Link href="/teams/create" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
          />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="No campaigns are accepting teams right now"
            body="Teams raise toward a live campaign, so there needs to be one running first."
            action={<Link href="/create" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Start a campaign</Link>}
          />
        ) : (
          <CreateTeamWizard campaigns={campaigns} />
        )}
      </Section>

      <Section id="members" heading="How members join">
        <div style={{ padding: '22px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: '680px' }}>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, margin: 0 }}>
            There is no invite form here, deliberately. On CharitMe each supporter creates their
            <strong style={{ color: 'var(--t1)' }}> own team page</strong> against the same campaign,
            and everything they raise counts toward the same total. So &ldquo;inviting members&rdquo; is
            sharing the campaign link — which the wizard hands you as soon as your team exists.
          </p>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, marginTop: '12px' }}>
            An email-invite form would look tidier and would have nowhere to store the invitations.
          </p>
        </div>
      </Section>

      <Section id="tips" heading="Three things that make a team work">
        <CardGrid min={260}>
          {TIPS.map((t) => <InfoCard key={t.title} title={t.title} body={t.body} />)}
        </CardGrid>
      </Section>
    </PageBody>
  );
}
