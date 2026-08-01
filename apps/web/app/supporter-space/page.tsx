import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { campaignDaysLeft } from '../../lib/campaign-lifecycle';
import { CampaignCard, CampaignGrid, type CampaignCardData } from '../../components/CampaignCard';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';
import { EmptyState } from '../../components/ui';

export const metadata: Metadata = {
  title: 'Supporter Space',
  description:
    'Where should you give? Answered from live campaign data — what is closing soonest, what is verified, and what is furthest from its goal right now.',
  alternates: { canonical: 'https://www.charitme.com/supporter-space' },
};

export const revalidate = 300;

const SELECT =
  'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score';

interface Buckets {
  closingSoon: CampaignCardData[];
  verified: CampaignCardData[];
  furthest: CampaignCardData[];
}

/**
 * The three answers to "where should I give?", derived from live data.
 *
 * `null` on failure — deliberately distinct from empty buckets. Telling a donor
 * there is nothing urgent to fund when the database was simply unreachable is
 * the same lie as the homepage's "Raised on CharitMe $0".
 *
 * One read, bucketed in memory, rather than three round-trips. Bounded by
 * `.limit()`, which is what `__tests__/unbounded-reads.test.ts` requires — the
 * obvious "select every active campaign and sort in JS" is free at 500 rows and
 * a timeout at 500,000.
 */
async function getBuckets(): Promise<Buckets | null> {
  try {
    const cols = await campaignColumns();

    const [closing, verified, needing] = await Promise.all([
      applyLiveFilters(supabaseAdmin.from('campaigns').select(SELECT), cols)
        .not('deadline', 'is', null)
        .gte('deadline', new Date().toISOString())
        .order('deadline', { ascending: true })
        .limit(6),
      applyLiveFilters(supabaseAdmin.from('campaigns').select(SELECT), cols)
        .eq('trust_status', 'Verified')
        .order('raised_amount', { ascending: false })
        .limit(6),
      // "Furthest from its goal" is the honest read of most-needed: sorted by
      // least raised, so the campaigns nobody has found yet surface instead of
      // the ones already succeeding.
      applyLiveFilters(supabaseAdmin.from('campaigns').select(SELECT), cols)
        .order('raised_amount', { ascending: true })
        .limit(6),
    ]);

    if (closing.error || verified.error || needing.error) return null;

    return {
      closingSoon: (closing.data ?? []) as CampaignCardData[],
      verified: (verified.data ?? []) as CampaignCardData[],
      furthest: (needing.data ?? []) as CampaignCardData[],
    };
  } catch {
    return null;
  }
}

const HOW_TO_CHOOSE = [
  {
    title: 'Urgency is a real signal',
    body: 'A campaign days from its deadline with a gap left is where a gift changes the outcome rather than adding to a total that was already going to be reached.',
  },
  {
    title: 'Verification tells you who, not whether',
    body: 'A verified badge means we confirmed the identity receiving the money. It is not an endorsement of the cause, and it is not a promise the money will be spent as described.',
  },
  {
    title: 'Small campaigns move further per dollar',
    body: 'The same $50 is a rounding error on a $100,000 appeal and a meaningful fraction of a $1,200 one. Both matter; they do different things.',
  },
  {
    title: 'Recurring beats one-off',
    body: 'A predictable $10 a month can be planned against in a way an unpredictable $120 cannot. It is also how most people end up giving more overall.',
  },
];

const DONOR_TOOLS = [
  { title: 'Your giving impact', body: 'Everything you have funded, what it went to, and updates from the campaigns you backed.', href: '/donor' },
  { title: 'Achievements', body: 'Giving streaks, levels, and badges earned across your donation history.', href: '/achievements' },
  { title: 'Recurring gifts', body: 'Review, change, or cancel monthly donations at any time.', href: '/dashboard/recurring' },
  { title: 'Tax statements', body: 'Annual giving statements and official receipts for tax-deductible gifts.', href: '/donor' },
];

const LEARN = [
  { title: 'How to read a campaign', body: 'What to look for, and the warning signs worth taking seriously.', href: '/impact-education' },
  { title: 'How verification works', body: 'What we check before money moves — and what we cannot check.', href: '/verification' },
  { title: 'Where your money goes', body: 'The full fee breakdown, including the parts that are unflattering.', href: '/fees' },
  { title: 'Give to many at once', body: 'Split one gift across several campaigns with a single receipt.', href: '/give' },
];

function Bucket({
  id,
  heading,
  intro,
  campaigns,
  emptyBody,
}: {
  id: string;
  heading: string;
  intro: string;
  campaigns: CampaignCardData[];
  emptyBody: string;
}) {
  return (
    <Section id={id} heading={heading} intro={intro}>
      {campaigns.length === 0 ? (
        <EmptyState
          icon="🌱"
          title="Nothing here right now"
          body={emptyBody}
          action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse all campaigns</Link>}
        />
      ) : (
        <CampaignGrid>
          {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </CampaignGrid>
      )}
    </Section>
  );
}

export default async function SupporterSpacePage() {
  const buckets = await getBuckets();

  // The countdown for the lede comes from the shared helper, so this page cannot
  // claim "3 days left" about a campaign another surface calls ended.
  const soonest = buckets?.closingSoon[0];
  const soonestDays = soonest ? campaignDaysLeft(soonest.deadline) : null;

  return (
    <PageBody>
      <PageHero
        eyebrow="SUPPORTER SPACE"
        title="Where should you give?"
        lede={
          soonestDays !== null && soonestDays >= 0
            ? `Answered from live campaign data rather than an inspiration page. Right now the most urgent campaign on CharitMe has ${soonestDays === 1 ? '1 day' : `${soonestDays} days`} left.`
            : 'Answered from live campaign data rather than an inspiration page — what is closing soonest, what is verified, and what is furthest from its goal right now.'
        }
        actions={
          <>
            <Link href="/campaigns" className="cta-primary" style={{ display: 'inline-flex' }}>
              Browse all campaigns
            </Link>
            <Link
              href="/causes"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Explore by cause
            </Link>
          </>
        }
      />

      {buckets === null ? (
        <EmptyState
          icon="⚠️"
          title="We couldn't load campaigns just now"
          body="This is a problem on our side, not an empty platform. Please refresh in a moment."
          action={<Link href="/supporter-space" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
        />
      ) : (
        <>
          <Bucket
            id="closing-soon"
            heading="Closing soonest"
            intro="Campaigns with a deadline approaching. A gift here changes whether the goal is reached, rather than adding to one that was already going to be."
            campaigns={buckets.closingSoon}
            emptyBody="No campaigns are closing in the near future."
          />
          <Bucket
            id="verified"
            heading="Identity verified"
            intro="The fundraiser's identity has been confirmed and payouts are enabled. That tells you who receives the money — not that we endorse the cause."
            campaigns={buckets.verified}
            emptyBody="No verified campaigns to show right now."
          />
          <Bucket
            id="furthest"
            heading="Furthest from their goal"
            intro="The campaigns fewest people have found. The same amount goes further here than on an appeal that is already close."
            campaigns={buckets.furthest}
            emptyBody="No campaigns to show right now."
          />
        </>
      )}

      <Section
        id="how-to-choose"
        heading="How to choose between them"
        intro="Four things that genuinely change what a gift does. None of them is about which story moved you most."
      >
        <CardGrid min={270}>
          {HOW_TO_CHOOSE.map((h) => <InfoCard key={h.title} title={h.title} body={h.body} />)}
        </CardGrid>
      </Section>

      <Section id="your-giving" heading="Your giving" intro="Sign in to see your own history, impact, and receipts.">
        <CardGrid min={250}>
          {DONOR_TOOLS.map((d) => <InfoCard key={d.href} title={d.title} body={d.body} href={d.href} />)}
        </CardGrid>
      </Section>

      <Section id="learn" heading="Before you give">
        <CardGrid min={250}>
          {LEARN.map((l) => <InfoCard key={l.href} title={l.title} body={l.body} href={l.href} />)}
        </CardGrid>
      </Section>

      <CtaBand
        heading="Give once, fund several"
        body="Split a single amount across several campaigns and get one receipt for all of it."
        primary={{ label: 'Give to many causes', href: '/give' }}
        secondary={{ label: 'Get involved another way', href: '/get-involved' }}
      />
    </PageBody>
  );
}
