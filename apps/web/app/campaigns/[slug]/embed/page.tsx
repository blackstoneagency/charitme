/* eslint-disable @next/next/no-img-element */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { formatMoneyShort } from '@shared/currencies';
import DonateButton from '../DonateButton';
import { parseWidgetOptions, WIDGET_MAX_WIDTH } from '../../../../lib/widget-embed';

export const dynamic = 'force-dynamic';

// Minimal iframe-friendly campaign embed — no nav, no footer.
// Use: <iframe src="https://charitme.com/campaigns/[slug]/embed" width="400" height="500" frameborder="0"></iframe>

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabaseAdmin.from('campaigns').select('title').eq('slug', slug).single();
  return { title: data?.title ?? 'Donate', robots: { index: false } };
}

export default async function CampaignEmbedPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // Options come from the query so the configurator's preview and the snippet
  // it hands out are the same URL. Never throws: a malformed query renders the
  // default widget rather than an error page inside someone else's iframe.
  const options = parseWidgetOptions(await searchParams);
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, cover_image_url, raised_amount, goal_amount, backer_count, status, accept_donations, visibility')
    .eq('slug', slug)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single();

  if (!campaign || (campaign as { visibility?: string }).visibility === 'private') notFound();

  const { data: launchSettings } = await supabaseAdmin
    .from('campaign_launch_settings')
    .select('currency')
    .eq('campaign_id', campaign.id)
    .maybeSingle();
  const currency = launchSettings?.currency ?? 'usd';

  const raised = campaign.raised_amount ?? 0;
  const goal   = campaign.goal_amount || 1;
  const pct    = Math.min(100, Math.round((raised / goal) * 100));
  const fmt    = (c: number) => formatMoneyShort(c, currency);
  const acceptDonations = (campaign as { accept_donations?: boolean }).accept_donations !== false;

  return (
    <main
      className={`campaign-embed campaign-embed--${options.theme}`}
      // The iframe sizes the widget, so the page fills it rather than pinning
      // itself to 400px — a 520px frame would otherwise show a 400px widget in a
      // band of empty page. The cap only matters when the URL is opened directly
      // in a full browser tab.
      style={{ padding: '20px', maxWidth: WIDGET_MAX_WIDTH, minHeight: '100vh' }}
    >
        {options.showCover && campaign.cover_image_url && (
          <img
            src={campaign.cover_image_url}
            alt={campaign.title}
            style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }}
          />
        )}

        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', /* theme-keep: standalone embed widget */ marginBottom: 4, lineHeight: 1.3 }}>
          {campaign.title}
        </h2>
        {campaign.tagline && (
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>{campaign.tagline}</p>
        )}

        {/* Progress */}
        {options.showProgress && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-text)' }}>{fmt(raised)}</span>
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>of {fmt(goal)}</span>
          </div>
          <div style={{ background: 'var(--s3, #e8ecf4)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ background: 'var(--violet)', width: `${pct}%`, height: '100%', borderRadius: 99 }} />
          </div>
          {options.showDonorCount && (
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 5 }}>
              {pct}% · {campaign.backer_count.toLocaleString()} donors
            </div>
          )}
        </div>
        )}

        {acceptDonations ? (
          <DonateButton campaignId={campaign.id} campaignTitle={campaign.title} currency={currency} />
        ) : (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 10, padding: '12px 14px', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
            Donations are temporarily paused.
          </div>
        )}

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com'}/campaigns/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}
          >
            Powered by CharitMe
          </a>
        </div>
    </main>
  );
}
