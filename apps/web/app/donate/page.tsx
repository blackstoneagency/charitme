import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { CampaignCard, CampaignGrid, type CampaignCardData } from '../../components/CampaignCard';
import { POPULAR_CAUSES, causeBrowseHref } from '../../lib/causes';
import { PageBody, PageHero, Section, CardGrid, InfoCard } from '../../components/PageShell';
import { EmptyState } from '../../components/ui';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'Give to a cause you care about. Browse verified campaigns, give once or monthly, and see exactly where your money goes before you confirm.',
  alternates: { canonical: 'https://www.charitme.com/donate' },
};

export const revalidate = 300;

const HOW = [
  {
    title: 'Pick a campaign',
    step: 'STEP 01',
    body: 'Browse by cause or search directly. Every campaign shows a trust score, whether the fundraiser is verified, and whether gifts are tax deductible.',
  },
  {
    title: 'Choose your amount',
    step: 'STEP 02',
    body: 'Give once or set up a monthly gift. You will see the processing fee and the optional tip broken out before you confirm — the tip is reducible to zero, always.',
  },
  {
    title: 'Get your receipt',
    step: 'STEP 03',
    body: 'Receipts are emailed immediately. Gifts to verified nonprofits also receive an official tax receipt, and your annual giving statement is available any time from your donor portal.',
  },
];

/** `null` distinguishes a failed read from a genuinely empty result set. */
async function getFeatured(): Promise<CampaignCardData[] | null> {
  try {
    const cols = await campaignColumns();
    const { data, error } = await applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select(
          'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, deadline, category, status, trust_status, nonprofit_verified, location, campaign_health_score',
        ),
      cols,
    )
      .order('raised_amount', { ascending: false })
      .limit(6);

    if (error) return null;
    return (data ?? []) as CampaignCardData[];
  } catch {
    return null;
  }
}

export default async function DonatePage() {
  const featured = await getFeatured();

  return (
    <PageBody>
      <PageHero
        eyebrow="GIVE"
        title="Donate to a cause that matters to you"
        lede="Every campaign on CharitMe shows you who is raising, what for, and how much has come in. No mandatory platform fee means more of your gift reaches the people it was meant for."
        actions={
          <>
            <Link href="/campaigns" className="cta-primary" style={{ display: 'inline-flex' }}>
              Browse all campaigns
            </Link>
            <Link
              href="/causes"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Explore causes
            </Link>
          </>
        }
      />

      <Section
        id="featured"
        heading="Campaigns raising right now"
        intro="The most-supported live campaigns on the platform."
      >
        {featured === null ? (
          <EmptyState
            icon="⚠️"
            title="We couldn't load campaigns just now"
            body="This is a problem on our side. Please refresh in a moment."
            action={<Link href="/donate" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
          />
        ) : featured.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="No live campaigns right now"
            body="Check back shortly, or start one yourself."
            action={<Link href="/create" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Start a fundraiser</Link>}
          />
        ) : (
          <CampaignGrid>
            {featured.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </CampaignGrid>
        )}
      </Section>

      <Section id="by-cause" heading="Give by cause" intro="Pick the area you care about most.">
        <CardGrid min={230}>
          {POPULAR_CAUSES.map((cause) => (
            <InfoCard key={cause.slug} title={cause.label} body={cause.blurb} href={causeBrowseHref(cause)} />
          ))}
        </CardGrid>
      </Section>

      <Section id="how" heading="How giving works here">
        <CardGrid min={280}>
          {HOW.map((h) => (
            <InfoCard key={h.title} step={h.step} title={h.title} body={h.body} />
          ))}
        </CardGrid>
      </Section>

      <Section
        id="other-ways"
        heading="Other ways to give"
        intro="Money is not the only useful thing you can offer."
      >
        <CardGrid min={250}>
          <InfoCard title="Volunteer your time" body="Find opportunities with organisations that need hands rather than funds." href="/volunteer" />
          <InfoCard title="Attend an event" body="Fundraising events near you and online." href="/events" />
          <InfoCard title="Double your gift" body="Many employers match charitable donations. Check whether yours does." href="/matching" />
          <InfoCard title="Sponsor a campaign" body="Back a campaign publicly and encourage others to follow." href="/sponsor" />
        </CardGrid>
      </Section>
    </PageBody>
  );
}
