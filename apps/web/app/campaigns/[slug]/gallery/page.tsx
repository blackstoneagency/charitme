import 'server-only';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCampaignResult } from '../get-campaign';
import CampaignUnavailable from '../../../../components/CampaignUnavailable';
import { supabaseAdmin } from '../../../../lib/supabase';
import { uploadedCoverUrl } from '../../../../lib/campaign-media-storage';
import GalleryGrid from './GalleryGrid';
import {
  toGalleryItem,
  sortGallery,
  coverAsGalleryItem,
  type CampaignMediaRow,
  type GalleryItem,
} from '../../../../lib/campaign-gallery-core';

export const dynamic = 'force-dynamic';

/**
 * Composite image page 61 — the campaign Media Gallery.
 *
 * What the data actually is, measured before this page was written:
 *
 * - `campaign_media` holds 500 rows with genuine metadata (media_type, caption,
 *   alt_text, sort_order) but `public_url` values on `storage.CharitMe.example`.
 *   `.example` is a RESERVED TLD (RFC 2606) — those files cannot be fetched from
 *   anywhere, by anyone, ever. One row per campaign.
 * - The public `campaign-media` bucket holds **500 real uploaded WebP covers**
 *   under `covers/<slug>.webp`, verified reachable.
 *
 * So the honest gallery is: the campaign's real uploaded cover, plus its
 * `campaign_media` records — with unfetchable items shown as unavailable rather
 * than silently swapped for a stock photo. That substitution is correct for a
 * campaign CARD (it needs some image) and wrong here, where the page's whole
 * claim is "these are photos from this campaign". A stock photo of strangers
 * under the caption "showing progress and impact" tells a donor something false
 * about where their money went.
 *
 * The mock's upload control is deliberately not rendered for the public.
 * Uploading belongs to the organiser's dashboard, behind auth; a public upload
 * button would either be dead or an unauthenticated write path.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const metaResult = await getCampaignResult(slug);
  // Metadata must never crash the page; an unreadable row falls back to
  // the generic title rather than throwing.
  const campaign = metaResult.ok ? metaResult.campaign : null;
  if (!campaign) return { title: 'Campaign gallery | CharitMe' };
  const title = `Media gallery — ${campaign.title} | CharitMe`;
  const description = `Photos and videos from "${campaign.title}", posted by the organiser.`;
  return {
    title,
    description,
    alternates: { canonical: `/campaigns/${slug}/gallery` },
    openGraph: { title, description, url: `/campaigns/${slug}/gallery`, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** `null` means the read FAILED — distinct from "this campaign posted no media". */
async function loadMedia(campaignId: string): Promise<CampaignMediaRow[] | null> {
  try {    // supabaseAdmin is a Proxy that THROWS on property access when the env is
    // missing, so `.from(...)` throws before any query runs — which the error
    // check below cannot see. The `null` contract this function already
    // declares is the correct degraded answer, so a throw takes the same path.

    const { data, error } = await supabaseAdmin
      .from('campaign_media')
      .select('id, media_type, public_url, storage_path, caption, alt_text, sort_order, created_at')
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true })
      .limit(200);
    if (error) {
      console.warn('[campaign/gallery] read failed', { code: error.code });
      return null;
    }
    return data ?? [];
  
  } catch {
    return null;
  }
}

export default async function CampaignGalleryPage({ params }: Props) {
  const { slug } = await params;
  const result = await getCampaignResult(slug);
  // An unreadable database is not a missing campaign — never 404 on it.
  if (!result.ok && result.reason === 'unavailable') return <CampaignUnavailable slug={slug} />;
  if (!result.ok) notFound();
  const campaign = result.campaign;

  const [rows, cover] = await Promise.all([
    loadMedia(campaign.id),
    uploadedCoverUrl(campaign.slug),
  ]);

  let items: GalleryItem[] | null = null;
  if (rows !== null) {
    const fromRows = sortGallery(rows.map(toGalleryItem), rows);
    const coverItem = coverAsGalleryItem(cover, campaign.title);
    items = coverItem ? [coverItem, ...fromRows] : fromRows;
  }

  return (
    <div className="container" style={{ padding: '28px 0 72px' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 20 }}>
        <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', margin: 0, padding: 0, fontSize: 13, color: 'var(--t3)' }}>
          <li><Link href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, color: 'var(--t3)', textDecoration: 'none' }}>Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/campaigns" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, color: 'var(--t3)', textDecoration: 'none' }}>Campaigns</Link></li>
          <li aria-hidden="true">/</li>
          <li style={{ minWidth: 0 }}>
            <Link href={`/campaigns/${slug}`} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, color: 'var(--t3)', textDecoration: 'none' }}>
              {campaign.title}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: 'var(--t1)', fontWeight: 700 }}>Gallery</li>
        </ol>
      </nav>

      <header style={{ maxWidth: 720, marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.02em', margin: 0 }}>
          Media gallery
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t3)', lineHeight: 1.6, marginTop: 8 }}>
          Photos and videos from {campaign.title}, posted by the organiser.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
          <Link href={`/campaigns/${slug}`} className="cta-primary" style={{ display: 'inline-flex' }}>
            View campaign
          </Link>
          <Link
            href={`/campaigns/${slug}/updates`}
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 18px',
              borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
            }}
          >
            Read updates
          </Link>
        </div>
      </header>

      <GalleryGrid items={items} campaignSlug={slug} />
    </div>
  );
}
