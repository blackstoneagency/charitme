import 'server-only';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCampaign } from '../get-campaign';
import { supabaseAdmin } from '../../../../lib/supabase';
import { getAppOrigin } from '../../../../lib/auth-config';
import { resolveCampaignCover } from '../../../../lib/covers';
import CampaignImage from '../../../../components/CampaignImage';
import ShareButtons from '../ShareButtons';
import UpdatesFeed from './UpdatesFeed';
import {
  visibleUpdates,
  sortForFeed,
  type CampaignUpdateRow,
} from '../../../../lib/campaign-updates-core';

export const dynamic = 'force-dynamic';

/**
 * Composite image page 60 — the public "Cause Updates" feed.
 *
 * This page exists because 740 rows of `campaign_updates` had NO readable public
 * surface. The campaign detail page fetches four of them and renders only the
 * TITLE and DATE in a sidebar timeline — the `body` is selected and thrown away,
 * so an organiser writing a detailed progress report was publishing into a void.
 * The detail page's "Updates (N)" tab compounded it by anchoring at `#updates`,
 * an id that sits on the CO-ORGANISERS block; clicking it scrolled to the wrong
 * section entirely. Both are fixed by this page existing and being linked.
 *
 * ⚠️ Visibility is the security surface here. `campaign_updates` stores drafts
 * (neither published_at nor scheduled_at) and future-scheduled posts alongside
 * live ones. The rule is filtered in the query AND re-applied in
 * `visibleUpdates()` — see `lib/campaign-updates-core.ts`, where it is unit
 * tested. Defence in depth, because a PostgREST `.or()` combining a null check
 * with a timestamp comparison is easy to get subtly wrong, and getting it wrong
 * leaks an organiser's unpublished announcement.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) return { title: 'Campaign updates | CharitMe' };
  const title = `Updates — ${campaign.title} | CharitMe`;
  const description = `Progress reports and milestones from "${campaign.title}", written by the organiser.`;
  return {
    title,
    description,
    alternates: { canonical: `/campaigns/${slug}/updates` },
    openGraph: { title, description, url: `/campaigns/${slug}/updates`, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * `null` means the READ FAILED — never conflated with "this campaign has posted
 * no updates". The two need different words on screen: one is an apology, the
 * other is ordinary and the reader should not be alarmed by it.
 */
async function loadUpdates(campaignId: string): Promise<CampaignUpdateRow[] | null> {
  const { data, error } = await supabaseAdmin
    .from('campaign_updates')
    .select('id, title, body, created_at, published_at, scheduled_at, ai_generated')
    .eq('campaign_id', campaignId)
    .or(`published_at.not.is.null,scheduled_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.warn('[campaign/updates] read failed', { code: error.code });
    return null;
  }
  return sortForFeed(visibleUpdates(data ?? []));
}

export default async function CampaignUpdatesPage({ params }: Props) {
  const { slug } = await params;
  const campaign = await getCampaign(slug);
  if (!campaign) notFound();

  const updates = await loadUpdates(campaign.id);
  const origin = getAppOrigin();
  const campaignUrl = `${origin}/campaigns/${slug}`;
  const cover = await resolveCampaignCover(campaign.cover_image_url, campaign.category, campaign.slug);

  const goal = Number(campaign.goal_amount ?? 0);
  const raised = Number(campaign.raised_amount ?? 0);
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const money = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      .format(cents / 100);

  return (
    <div className="container" style={{ padding: '28px 0 72px' }}>
      {/* Breadcrumb — the design shows one, and it is the only way back to the
          campaign from a deep-linked update. */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: 22 }}>
        <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: 'var(--t3)' }}>
          <li><Link href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, color: 'var(--t3)', textDecoration: 'none' }}>Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/campaigns" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, color: 'var(--t3)', textDecoration: 'none' }}>Campaigns</Link></li>
          <li aria-hidden="true">/</li>
          <li style={{ minWidth: 0 }}>
            <Link href={`/campaigns/${slug}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, color: 'var(--t3)', textDecoration: 'none' }}>{campaign.title}</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--t1)', fontWeight: 700 }}>Updates</li>
        </ol>
      </nav>

      <div
        className="cu-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* ── Sidebar: the campaign this feed belongs to ─────────────────── */}
        <aside style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, minWidth: 0 }}>
          <div style={{ border: '1px solid var(--b1)', borderRadius: 'var(--rl)', overflow: 'hidden', background: 'var(--s1)' }}>
            <CampaignImage
              src={cover}
              category={campaign.category}
              campaignKey={campaign.slug}
              alt={`Cover photo for ${campaign.title}`}
              width={300}
              height={170}
              className="cu-cover"
            />
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 750, color: 'var(--t1)', lineHeight: 1.3, margin: 0 }}>
                {campaign.title}
              </h2>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>{money(raised)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--t3)' }}>
                  raised of {money(goal)} goal
                </div>
              </div>
              {/* Non-colour status indicator: the percentage is stated in text as
                  well as drawn, so the bar is not the only carrier of meaning. */}
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${pct}% of goal raised`}
                style={{ height: 8, borderRadius: 999, background: 'var(--s3)', overflow: 'hidden' }}
              >
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--fill-warm)' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12.5, color: 'var(--t3)' }}>
                <span><b style={{ color: 'var(--t1)' }}>{campaign.backer_count ?? 0}</b> donors</span>
                <span aria-hidden="true">·</span>
                <span><b style={{ color: 'var(--t1)' }}>{pct}%</b> of goal</span>
              </div>
              <Link
                href={`/campaigns/${slug}`}
                className="cta-primary"
                style={{ display: 'inline-flex', justifyContent: 'center' }}
              >
                View campaign page
              </Link>
            </div>
          </div>

          <div style={{ border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', padding: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 750, color: 'var(--t1)', margin: '0 0 12px' }}>Share this campaign</h3>
            {/* Reuses the SAME ShareButtons + /api/share-events attribution path
                as the detail and share pages. A second share implementation here
                would fragment the conversion numbers the organiser sees. */}
            <ShareButtons
              campaignId={campaign.id}
              campaignUrl={campaignUrl}
              campaignTitle={campaign.title}
              qrUrl={`${campaignUrl}?utm_source=qr`}
              qrPosterId={`qr-updates-${campaign.id}`}
            />
          </div>
        </aside>

        {/* ── The feed ───────────────────────────────────────────────────── */}
        <main style={{ minWidth: 0 }}>
          <header style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.02em', margin: 0 }}>
              Updates
            </h1>
            <p style={{ fontSize: 15, color: 'var(--t3)', lineHeight: 1.6, marginTop: 8 }}>
              Progress reports and milestones, written by the organiser of {campaign.title}.
            </p>
          </header>

          <UpdatesFeed updates={updates} campaignSlug={slug} />
        </main>
      </div>
    </div>
  );
}
