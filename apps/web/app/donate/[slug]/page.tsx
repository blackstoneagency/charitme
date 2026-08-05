import 'server-only';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCampaign } from '../../campaigns/[slug]/get-campaign';
import { resolveCampaignCover } from '../../../lib/covers';
import CampaignImage from '../../../components/CampaignImage';
import GuidedDonation from './GuidedDonation';

export const dynamic = 'force-dynamic';

/**
 * The guided donation flow for one campaign.
 *
 * `/donate` is step 1 of the reference (choose a campaign); this is steps 2–7,
 * after which **Stripe Checkout** takes over for the payment method, the card
 * fields and the final confirm. It posts to the same `POST /api/donations` the
 * campaign page uses, so there is one server-side donation path rather than a
 * parallel checkout that could drift from the one carrying real money.
 */

type Props = { params: Promise<{ slug: string }> };

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

  // A campaign that is not live cannot take money. Saying so beats rendering a
  // form whose submit would be refused by the API after the donor has filled it in.
  const acceptingDonations = campaign.status === 'active';

  const cover = await resolveCampaignCover(campaign.cover_image_url, campaign.category, campaign.slug);
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
        <h1 style={{ margin: '0 0 8px', fontSize: 30, lineHeight: 1.15, fontWeight: 850, color: 'var(--t1)', letterSpacing: '-0.02em' }}>
          Donate to {campaign.title}
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--t2)', maxWidth: 620 }}>
          A few short steps. The platform takes 0% — what you give goes to the organiser,
          minus the payment processor&rsquo;s own fee.
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
        <GuidedDonation campaignId={campaign.id} campaignTitle={campaign.title} campaignSlug={campaign.slug} />
      ) : (
        <section style={{ padding: 20, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: 620, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 750, color: 'var(--t1)' }}>
            This campaign is not accepting donations right now
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 14.5, color: 'var(--t2)' }}>
            It is not currently live, so a donation would be refused after you filled the
            form in. We would rather say so here.
          </p>
          <Link href="/campaigns" style={{ color: 'var(--brand-text)', fontWeight: 650, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
            Find another campaign to support →
          </Link>
        </section>
      )}
    </main>
  );
}
