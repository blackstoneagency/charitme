import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '../../lib/query-timeout';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { campaignDaysLeft } from '../../lib/campaign-lifecycle';
import { CampaignCard, CampaignGrid, type CampaignCardData } from '../../components/CampaignCard';
import {
  ReferenceCardGrid,
  ReferenceCta,
  ReferenceHero,
  ReferenceIconGrid,
  ReferencePage,
  ReferenceSection,
  ReferenceStats,
} from '../../components/ReferenceMarketing';
import { EmptyState } from '../../components/ui';
import { getDistinctDisplayPhotos } from '../../lib/photo-catalog';

export const metadata: Metadata = {
  title: 'Where to Give',
  description: 'Explore live CharitMe campaigns by urgency, verification, and funding progress, then choose where your gift can make a difference.',
  alternates: { canonical: 'https://www.charitme.com/supporter-space' },
};

export const revalidate = 300;

const SELECT = 'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score, is_demo';

type Buckets = {
  closingSoon: CampaignCardData[];
  verified: CampaignCardData[];
  furthest: CampaignCardData[];
};

async function getBuckets(): Promise<Buckets | null> {
  try {
    const cols = await campaignColumns();
    const [closing, verified, needing] = await Promise.all([
      boundedQuery(() => applyLiveFilters(supabaseAdmin.from('campaigns').select(SELECT), cols)
        .not('deadline', 'is', null).gte('deadline', new Date().toISOString()).order('deadline', { ascending: true }).limit(6)),
      boundedQuery(() => applyLiveFilters(supabaseAdmin.from('campaigns').select(SELECT), cols)
        .eq('trust_status', 'Verified').order('raised_amount', { ascending: false }).limit(6)),
      boundedQuery(() => applyLiveFilters(supabaseAdmin.from('campaigns').select(SELECT), cols)
        .order('raised_amount', { ascending: true }).limit(6)),
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
  { icon: 'clock', title: 'Urgency Is a Real Signal', body: 'A campaign near its deadline with a gap left is one place a gift can change the outcome.' },
  { icon: 'shield', title: 'Understand Verification', body: 'Verification confirms who receives funds. It is not an endorsement or guarantee.' },
  { icon: 'target', title: 'Small Goals Move Faster', body: 'The same amount can cover a larger share of a smaller, clearly explained need.' },
  { icon: 'refresh', title: 'Recurring Support Adds Up', body: 'Predictable giving can help an organization plan beyond one urgent moment.' },
];

const DONOR_TOOLS = [
  { icon: 'chart', title: 'Your Giving Impact', body: 'See what you funded and read updates from campaigns you supported.', action: 'View impact', href: '/donor' },
  { icon: 'award', title: 'Achievements', body: 'Track giving streaks, levels, and badges across your history.', action: 'View achievements', href: '/achievements' },
  { icon: 'refresh', title: 'Recurring Gifts', body: 'Review, change, pause, or cancel recurring donations.', action: 'Manage gifts', href: '/dashboard/recurring' },
  { icon: 'document', title: 'Tax Statements', body: 'Generate annual statements and access qualifying receipts.', action: 'Open tax files', href: '/donor' },
];

const LEARN = [
  { icon: 'search', title: 'Read a Campaign', body: 'Know what to look for and which warning signs deserve attention.', action: 'Start learning', href: '/impact-education' },
  { icon: 'shield', title: 'Verification Process', body: 'See what CharitMe checks before money moves.', action: 'How verification works', href: '/verification' },
  { icon: 'dollar', title: 'Where Money Goes', body: 'Read the full fee and payment-processing breakdown.', action: 'View fees', href: '/fees' },
];

const CAUSES = [
  { icon: 'heart', title: 'All Causes', body: 'See every active campaign.', href: '/causes' },
  { icon: 'graduation', title: 'Education', body: 'Learning and youth opportunity.', href: '/causes/education' },
  { icon: 'home', title: 'Community', body: 'Local relief and shared spaces.', href: '/causes/community-relief' },
  { icon: 'heart', title: 'Health & Wellness', body: 'Care, treatment, and wellbeing.', href: '/causes/health-wellness' },
  { icon: 'paw', title: 'Animals', body: 'Animal care and wildlife protection.', href: '/causes/animals-planet' },
  { icon: 'leaf', title: 'Environment', body: 'Climate and conservation action.', href: '/causes/environment' },
];

function Bucket({ heading, intro, campaigns, emptyBody, covers }: { heading: string; intro: string; campaigns: CampaignCardData[]; emptyBody: string; covers: ReadonlyMap<string, string> }) {
  return (
    <ReferenceSection title={heading} intro={intro}>
      {campaigns.length === 0 ? (
        <EmptyState icon="♡" title="Nothing here right now" body={emptyBody} action={<Link href="/campaigns" className="rp-text-link">Browse all campaigns</Link>} />
      ) : (
        <CampaignGrid>{campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} coverScope="supporter-space" coverOverride={covers.get(campaign.id)} />)}</CampaignGrid>
      )}
    </ReferenceSection>
  );
}

export default async function SupporterSpacePage() {
  const buckets = await getBuckets();
  const displayBuckets = buckets ? (() => {
    const seen = new Set<string>();
    const takeNew = (campaigns: CampaignCardData[]) => campaigns.filter((campaign) => {
      if (seen.has(campaign.id)) return false;
      seen.add(campaign.id);
      return true;
    });
    return {
      closingSoon: takeNew(buckets.closingSoon),
      verified: takeNew(buckets.verified),
      furthest: takeNew(buckets.furthest),
    };
  })() : null;
  const soonest = displayBuckets?.closingSoon[0];
  const soonestDays = soonest ? campaignDaysLeft(soonest.deadline) : null;
  const visibleCampaigns = displayBuckets
    ? [...displayBuckets.closingSoon, ...displayBuckets.verified, ...displayBuckets.furthest]
    : [];
  const visibleCategories = new Set(visibleCampaigns.map((campaign) => campaign.category).filter(Boolean));
  const distinctCovers = getDistinctDisplayPhotos(visibleCampaigns.map((campaign) => ({
    category: campaign.category,
    key: campaign.slug,
    storedCover: campaign.cover_image_url,
    pageScope: 'supporter-space',
  })));
  const covers = new Map(visibleCampaigns.map((campaign, index) => [campaign.id, distinctCovers[index]!]));

  return (
    <ReferencePage>
      <ReferenceHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Explore Causes', href: '/causes' }, { label: 'Where to Give' }]}
        eyebrow=""
        title={<>Where to Give</>}
        lede="Discover trusted causes and organizations making a real difference. Your support can change lives and create a better tomorrow."
        search={{ action: '/campaigns', placeholder: 'Search causes, charities, or keywords...' }}
        image="/images/reference/supporter-space-hero.jpg"
        imageAlt="Hands holding a heart in support of a cause"
        callout={{ icon: 'search', title: 'Find the Right Cause', body: 'Explore causes you care about and support verified organizations.' }}
        variant="catalog"
      />

      <ReferenceStats items={[
        { icon: 'megaphone', value: visibleCampaigns.length.toLocaleString(), label: 'Active campaigns loaded' },
        { icon: 'shield', value: (displayBuckets?.verified.length ?? 0).toLocaleString(), label: 'Verified campaigns shown' },
        { icon: 'globe', value: visibleCategories.size.toLocaleString(), label: 'Cause areas represented' },
        { icon: 'clock', value: soonestDays !== null && soonestDays >= 0 ? `${soonestDays}d` : 'Live', label: 'Most urgent deadline' },
      ]} />

      <ReferenceSection title="Browse by Cause" compact action={{ label: 'View all causes', href: '/causes' }}>
        <ReferenceIconGrid items={CAUSES} />
      </ReferenceSection>

      {displayBuckets === null ? (
        <div className="rp-section"><EmptyState icon="!" title="We couldn't load campaigns just now" body="This is a temporary data problem, not an empty platform." action={<Link href="/supporter-space" className="rp-text-link">Try again</Link>} /></div>
      ) : (
        <>
          <Bucket heading="Closing Soonest" intro="Campaigns with an approaching deadline, ordered from live campaign data." campaigns={displayBuckets.closingSoon} emptyBody="No campaigns are closing in the near future." covers={covers} />
          <Bucket heading="Identity Verified" intro="The fundraiser's identity has been confirmed and payouts are enabled." campaigns={displayBuckets.verified} emptyBody="No verified campaigns are available right now." covers={covers} />
          <Bucket heading="Furthest From Their Goal" intro="Campaigns that have raised the least and may not have reached many supporters yet." campaigns={displayBuckets.furthest} emptyBody="No campaigns are available right now." covers={covers} />
        </>
      )}

      <ReferenceSection title="How to Choose Between Them" intro="Four things that genuinely change what a gift does.">
        <ReferenceCardGrid items={HOW_TO_CHOOSE} />
      </ReferenceSection>

      <ReferenceSection title="Your Giving Tools" intro="Sign in to see your history, impact, recurring support, and tax files.">
        <ReferenceCardGrid items={DONOR_TOOLS} />
      </ReferenceSection>

      <ReferenceSection title="Before You Give">
        <ReferenceCardGrid items={LEARN} />
      </ReferenceSection>

      <ReferenceCta
        icon="heart"
        title="Find a Cause Worth Backing"
        body="Browse active fundraisers and give directly to the people running them."
        actions={[
          { label: 'Browse Campaigns', href: '/campaigns' },
          { label: 'Other Ways to Help', href: '/get-involved', variant: 'secondary' },
        ]}
      />
    </ReferencePage>
  );
}
