/* eslint-disable @next/next/no-img-element */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { formatMoneyShort, normalizeCurrency } from '@shared/currencies';
import DonateButton from '../DonateButton';
import { parseWidgetOptions, WIDGET_MAX_WIDTH } from '../../../../lib/widget-embed';
import { getDonationCheckoutSnapshot } from '../../../../lib/donation-checkout-settings';
import { getDisplayCover } from '../../../../lib/photo-catalog';

export const dynamic = 'force-dynamic';

// Minimal iframe-friendly campaign embed — no nav, no footer.
// Use: <iframe src="https://charitme.com/campaigns/[slug]/embed" width="400" height="500" frameborder="0"></iframe>

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  // Never throws. This runs for a widget embedded in SOMEONE ELSE'S page, so a
  // thrown error here renders a Next error document inside their site.
  try {
    // The page body below correctly 404s a private or deleted campaign, but this
    // ran first and filtered nothing — so the <title> of that 404 response could
    // still carry a private campaign's name. Same filters as the body, for the
    // same reason.
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('title')
      .eq('slug', slug)
      .neq('visibility', 'private')
      .is('deleted_at', null)
      .single();
    return { title: data?.title ?? 'Donate', robots: { index: false } };
  } catch {
    return { title: 'Donate', robots: { index: false } };
  }
}

export default async function CampaignEmbedPage({ params, searchParams }: Props) {
  const { slug } = await params;
  // Options come from the query so the configurator's preview and the snippet
  // it hands out are the same URL. Never throws: a malformed query renders the
  // default widget rather than an error page inside someone else's iframe.
  const options = parseWidgetOptions(await searchParams);

  // ⚠️ Three outcomes, and they must stay distinct because this renders inside a
  // PARTNER'S PAGE:
  //   · no row / private  → notFound(), the campaign genuinely is not embeddable
  //   · read threw        → a quiet "unavailable" widget
  //   · ok                → the widget
  // A throw previously produced a Next error document in the partner's iframe,
  // and routing it to notFound() instead would be worse: it would tell their
  // visitors the campaign does not exist every time our database hiccups.
  type EmbedCampaign = {
    id: string; slug: string; title: string; tagline: string | null;
    category: string | null;
    cover_image_url: string | null; raised_amount: number | null; goal_amount: number | null;
    backer_count: number | null; status: string | null; accept_donations: boolean | null;
    visibility?: string;
  };
  let campaign: EmbedCampaign | null = null;
  let currency = 'usd';
  const checkout = await getDonationCheckoutSnapshot();
  try {
    const { data } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, title, tagline, category, cover_image_url, raised_amount, goal_amount, backer_count, status, accept_donations, visibility')
      .eq('slug', slug)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();
    campaign = (data ?? null) as EmbedCampaign | null;

    if (!campaign || (campaign as { visibility?: string }).visibility === 'private') notFound();

    const { data: launchSettings, error: launchSettingsError } = await supabaseAdmin
      .from('campaign_launch_settings')
      .select('currency')
      .eq('campaign_id', campaign.id)
      .maybeSingle();
    if (launchSettingsError) throw new Error('Campaign currency is unavailable');
    currency = normalizeCurrency(launchSettings?.currency);
  } catch (e) {
    // `notFound()` signals by throwing — rethrow it rather than swallowing the
    // 404 into the "unavailable" branch.
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest?: unknown }).digest).startsWith('NEXT_')) throw e;
    return (
      <main style={{ padding: '20px', fontFamily: 'var(--font, system-ui)', fontSize: '14px', color: '#475069' }}>
        This donation widget is temporarily unavailable. Please try again shortly.
      </main>
    );
  }

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
        {options.showCover && (
          <img
            src={getDisplayCover(campaign.cover_image_url, campaign.category, campaign.slug, 'campaign-embed')}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-text)' }}>{fmt(raised)}</span>
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>of {fmt(goal)}</span>
          </div>
          <div style={{ background: 'var(--s3, #e8ecf4)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ background: 'var(--violet)', width: `${pct}%`, height: '100%', borderRadius: 99 }} />
          </div>
          {options.showDonorCount && (
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 5 }}>
              {pct}% · {(campaign.backer_count ?? 0).toLocaleString()} donors
            </div>
          )}
        </div>
        )}

        {acceptDonations ? (
          <DonateButton
            campaignId={campaign.id}
            campaignTitle={campaign.title}
            currency={currency}
            checkoutSettings={checkout.settings}
            checkoutRevision={checkout.revision}
          />
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
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}
          >
            Powered by CharitMe
          </a>
        </div>
    </main>
  );
}
