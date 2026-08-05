import 'server-only';
import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE } from '../../../../lib/public-routes';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCampaignResult } from '../get-campaign';
import CampaignUnavailable from '../../../../components/CampaignUnavailable';
import { supabaseAdmin } from '../../../../lib/supabase';
import { getAppOrigin } from '../../../../lib/auth-config';
import { resolveCampaignCover } from '../../../../lib/covers';
import CampaignImage from '../../../../components/CampaignImage';
import ShareButtons from '../ShareButtons';
import ShareTemplates from './ShareTemplates';
import { describeShareImpact, campaignShareUrl, type ShareStats } from '../../../../lib/share-page-core';

export const dynamic = 'force-dynamic';

/**
 * Public share page — the supporter-facing counterpart to
 * `/dashboard/campaigns/[id]/share`, which is owner-gated.
 *
 * Before this existed, a supporter who wanted to spread a campaign had nowhere to
 * go: the detail page carries inline share buttons, but nothing linkable, nothing
 * indexable, and nothing a campaign can point at in a text message.
 *
 * ⚠️ **Reuses `ShareButtons` and `POST /api/share-events` rather than adding a
 * second share path.** Those buttons write a `share_events` row, and both
 * `/api/donations` and the Stripe webhook read that row back to mark
 * `converted` + `donation_id`. A parallel implementation here would fragment that
 * attribution and quietly break the conversion numbers the organiser sees.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const metaResult = await getCampaignResult(slug);
  // Metadata must never crash the page; an unreadable row falls back to
  // the generic title rather than throwing.
  const campaign = metaResult.ok ? metaResult.campaign : null;
  if (!campaign) return { title: 'Share a campaign | CharitMe' };
  const title = `Share "${campaign.title}" | CharitMe`;
  const description = `Help "${campaign.title}" reach more people. Share it in one tap, or copy a message to send yourself.`;
  return {
    title,
    description,
    // Canonical points at the CAMPAIGN, not at this page: this is a helper
    // surface, and search engines should rank the campaign itself.
    alternates: { canonical: `/campaigns/${slug}` },
    openGraph: { title, description, url: `/campaigns/${slug}/share`, type: 'website', images: [{ url: DEFAULT_OG_IMAGE }] },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** `null` means the count FAILED — never conflated with "nobody has shared". */
async function loadShareStats(campaignId: string): Promise<ShareStats | null> {
  try {    // supabaseAdmin is a Proxy that THROWS on property access when the env is
    // missing, so `.from(...)` throws before any query runs — which the error
    // check below cannot see. The `null` contract this function already
    // declares is the correct degraded answer, so a throw takes the same path.

    const [total, converted] = await Promise.all([
      supabaseAdmin.from('share_events').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
      supabaseAdmin.from('share_events').select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId).eq('converted', true),
    ]);
    if (total.error || converted.error) {
      console.warn('[campaign/share] share stats failed', { code: total.error?.code ?? converted.error?.code });
      return null;
    }
    return { shares: total.count ?? 0, converted: converted.count ?? 0 };
  
  } catch {
    return null;
  }
}

export default async function CampaignSharePage({ params }: Props) {
  const { slug } = await params;
  const result = await getCampaignResult(slug);
  // An unreadable database is not a missing campaign — never 404 on it.
  if (!result.ok && result.reason === 'unavailable') return <CampaignUnavailable slug={slug} />;
  if (!result.ok) notFound();
  const campaign = result.campaign;

  const origin = getAppOrigin();
  const campaignUrl = campaignShareUrl(origin, slug);
  const stats = await loadShareStats(campaign.id);
  const impact = stats ? describeShareImpact(stats) : null;
  const cover = await resolveCampaignCover(campaign.cover_image_url, campaign.category, campaign.slug);

  const raised = Number(campaign.raised_amount ?? 0);
  const goal = Number(campaign.goal_amount ?? 0);
  // `null`, not 0 — a campaign with no goal is not at 0% of one.
  const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(campaignUrl)}&color=6c35ff&bgcolor=ffffff&margin=10`;

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 56px', minWidth: 0 }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 18 }}>
        {/* Breadcrumb links are padded to a 44px target. The sweep measured
            "Campaigns" at 73x15, which fails WCAG 2.2 SC 2.5.8 — a breadcrumb is
            a list of links, not prose, so the inline-text exception does not
            apply to it. */}
        <ol className="share-crumbs" style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', alignItems: 'center', gap: 8, listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: 'var(--t3)' }}>
          <li><Link href="/campaigns" style={{ color: 'var(--t3)' }}>Campaigns</Link></li>
          <li aria-hidden="true">›</li>
          <li><Link href={`/campaigns/${slug}`} style={{ color: 'var(--t3)' }}>{campaign.title}</Link></li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" style={{ color: 'var(--t2)', fontWeight: 650 }}>Share</li>
        </ol>
      </nav>

      <header style={{ marginBottom: 26 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, lineHeight: 1.15, fontWeight: 850, color: 'var(--t1)', letterSpacing: '-0.02em' }}>
          Help this campaign reach further
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--t2)', maxWidth: 620 }}>
          Sharing is the single most useful thing you can do without spending
          anything. One share puts this in front of people the organiser will
          never reach on their own.
        </p>
      </header>

      {/* What is being shared — so the person knows before they send it. */}
      <section aria-labelledby="campaign-heading" style={{ ...cardStyle, marginBottom: 26 }}>
        <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <CampaignImage
            src={cover}
            category={campaign.category ?? null}
            campaignKey={campaign.slug}
            alt=""
            width={160}
            height={110}
            loading="eager"
            className="share-cover"
          />
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h2 id="campaign-heading" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>
              <Link href={`/campaigns/${slug}`} style={{ color: 'inherit' }}>{campaign.title}</Link>
            </h2>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--t2)' }}>
              ${(raised / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} raised
              {percent !== null && (
                <> · <span style={{ color: 'var(--brand-text)', fontWeight: 700 }}>{percent}% of goal</span></>
              )}
              {' · '}
              {Number(campaign.backer_count ?? 0).toLocaleString()} supporters
            </p>
            {percent !== null && (
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${percent} percent of goal raised`}
                style={{ background: 'var(--b2)', borderRadius: 99, height: 8, overflow: 'hidden', maxWidth: 420 }}
              >
                <div style={{ background: 'var(--violet)', width: `${percent}%`, height: '100%', borderRadius: 99 }} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Real, tracked share buttons — the same component and endpoint the
          campaign page uses, so a share from here is attributable end to end. */}
      <section aria-labelledby="channels-heading" style={{ marginBottom: 30, minWidth: 0 }}>
        <h2 id="channels-heading" style={headingStyle}>Share it in one tap</h2>
        {impact && (
          <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--green-text)', fontWeight: 650 }}>{impact}</p>
        )}
        {stats === null && (
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--t3)' }}>
            Share figures are unavailable right now — that is a read failure, not
            a campaign nobody has shared. Sharing still works.
          </p>
        )}
        <ShareButtons
          campaignId={campaign.id}
          campaignUrl={campaignUrl}
          campaignTitle={campaign.title}
          qrUrl={qrUrl}
          qrPosterId={campaign.id}
        />
      </section>

      <ShareTemplates campaignTitle={campaign.title} campaignUrl={campaignUrl} />

      <aside style={{ ...cardStyle, marginTop: 30 }}>
        <h2 style={{ ...headingStyle, fontSize: 16, marginBottom: 8 }}>Other ways to help</h2>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
          <li><Link href={`/campaigns/${slug}`} style={linkStyle}>Donate to this campaign</Link> — the platform takes 0%.</li>
          <li><Link href="/matching" style={linkStyle}>Check for employer matching</Link> — some employers double what you give.</li>
          <li><Link href="/volunteer" style={linkStyle}>Volunteer your time</Link> if giving money is not an option right now.</li>
        </ul>
      </aside>
    </main>
  );
}

const cardStyle = {
  padding: 18, border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
  background: 'var(--s1)', minWidth: 0,
} as const;
const headingStyle = {
  margin: '0 0 6px', fontSize: 19, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em',
} as const;
const linkStyle = { color: 'var(--brand-text)', fontWeight: 650 } as const;
