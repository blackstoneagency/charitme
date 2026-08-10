import 'server-only';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCampaign } from '../../campaigns/[slug]/get-campaign';
import { resolveCampaignCover } from '../../../lib/covers';
import CampaignImage from '../../../components/CampaignImage';
import GuidedDonation from './GuidedDonation';
import { boundedQuery } from '../../../lib/query-timeout';
import { supabaseAdmin } from '../../../lib/supabase';
import { normalizeCurrency } from '@shared/currencies';
import { getDonationCheckoutSnapshot } from '../../../lib/donation-checkout-settings';
import { resolvePayoutDestination } from '../../../lib/payout-destination';

export const dynamic = 'force-dynamic';

/**
 * The unified donation checkout for one campaign. It renders the same shared
 * form and posts to the same server routes as the campaign, peer, and embed
 * surfaces so pricing and payment behavior cannot drift between entry points.
 */

type Props = { params: Promise<{ slug: string }> };

async function getCampaignCurrency(campaignId: string): Promise<string | null> {
  const { data, error } = await boundedQuery(() =>
    supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', campaignId)
      .maybeSingle(),
  );
  return error ? null : normalizeCurrency(data?.currency);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) return { title: 'Donate | CharitMe' };
  return {
    title: `Donate to "${campaign.title}" | CharitMe`,
    description: `Support "${campaign.title}". The platform takes 0% — your donation goes to the organiser.`,
    // The campaign is canonical; this is a checkout surface, not a page search
    // engines should rank in its place.
    alternates: { canonical: `/campaigns/${slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function GuidedDonatePage({ params }: Props) {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) notFound();

  const [cover, currency, checkout, payoutResult] = await Promise.all([
    resolveCampaignCover(campaign.cover_image_url, campaign.category, campaign.slug, 'donation-checkout'),
    getCampaignCurrency(campaign.id),
    getDonationCheckoutSnapshot(),
    resolvePayoutDestination(campaign)
      .then((destination) => ({ destination, unavailable: false }))
      .catch(() => ({ destination: null, unavailable: true })),
  ]);
  const acceptingDonations =
    campaign.status === 'active'
    && (campaign as { accept_donations?: boolean | null }).accept_donations !== false
    && currency !== null
    && payoutResult.destination !== null;
  const checkoutUnavailable = currency === null || payoutResult.unavailable;
  const raised = Number(campaign.raised_amount ?? 0);
  const goal = Number(campaign.goal_amount ?? 0);
  const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 56px', minWidth: 0 }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 18 }}>
        <ol style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', alignItems: 'center', gap: 8, listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: 'var(--t3)' }}>
          <li><Link href="/donate" style={{ color: 'var(--t3)', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>Donate</Link></li>
          <li aria-hidden="true">›</li>
          <li><Link href={`/campaigns/${slug}`} style={{ color: 'var(--t3)', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>{campaign.title}</Link></li>
        </ol>
      </nav>

      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, lineHeight: 1.15, fontWeight: 850, color: 'var(--t1)', letterSpacing: 0 }}>
          Donate to {campaign.title}
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--t2)', maxWidth: 620 }}>
          Choose an amount and review the CharitMe fee and payment estimate before secure checkout.
        </p>
      </header>

      <section aria-label="Campaign summary" style={{ padding: 16, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', marginBottom: 22, minWidth: 0 }}>
        <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <CampaignImage src={cover} category={campaign.category ?? null} campaignKey={campaign.slug} alt="" width={140} height={96} loading="eager" className="share-cover" />
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--t2)' }}>
              ${(raised / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} raised
              {percent !== null && <> · <span style={{ color: 'var(--brand-text)', fontWeight: 700 }}>{percent}% of goal</span></>}
              {' · '}{Number(campaign.backer_count ?? 0).toLocaleString()} supporters
            </p>
            {percent !== null && (
              <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${percent} percent of goal raised`} style={{ background: 'var(--b2)', borderRadius: 99, height: 8, overflow: 'hidden', maxWidth: 420 }}>
                <div style={{ background: 'var(--violet)', width: `${percent}%`, height: '100%', borderRadius: 99 }} />
              </div>
            )}
          </div>
        </div>
      </section>

      {acceptingDonations ? (
        <GuidedDonation
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          currency={currency}
          checkoutSettings={checkout.settings}
          checkoutRevision={checkout.revision}
        />
      ) : (
        <section style={{ padding: 20, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: 620, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 750, color: 'var(--t1)' }}>
            {checkoutUnavailable ? 'Secure checkout is temporarily unavailable' : 'This campaign is not accepting donations right now'}
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 14.5, color: 'var(--t2)' }}>
            {checkoutUnavailable
              ? 'We could not verify the campaign currency and recipient payout readiness just now. Nothing can be charged until those checks succeed.'
              : 'The campaign is not currently ready to take a payment, so checkout remains closed.'}
          </p>
          <Link href="/campaigns" style={{ color: 'var(--brand-text)', fontWeight: 650, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
            Find another campaign to support →
          </Link>
        </section>
      )}
    </main>
  );
}
