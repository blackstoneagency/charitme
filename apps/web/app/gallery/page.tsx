import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { getCoverForCampaign } from '../../lib/photo-catalog';
import { optimizedCoverUrl } from '../../lib/img-optimize';
import { PageBody, PageHero, Section, CtaBand } from '../../components/PageShell';
import { EmptyState } from '../../components/ui';

export const metadata: Metadata = {
  title: 'Gallery',
  description:
    'A visual look at the campaigns running on CharitMe — the people, projects, and causes being funded right now.',
  alternates: { canonical: 'https://www.charitme.com/gallery' },
};

export const revalidate = 600;

const LIMIT = 48;

interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  cover_image_url: string | null;
}

/** `null` on failure, so the page can tell "we broke" from "nothing to show". */
async function getGallery(): Promise<GalleryItem[] | null> {
  try {
    const cols = await campaignColumns();
    const { data, error } = await applyLiveFilters(
      supabaseAdmin.from('campaigns').select('id, slug, title, category, cover_image_url'),
      cols,
    )
      .order('raised_amount', { ascending: false })
      .limit(LIMIT);

    if (error) return null;
    return (data ?? []) as GalleryItem[];
  } catch {
    return null;
  }
}

export default async function GalleryPage() {
  const items = await getGallery();

  // Two campaigns falling back to the same placeholder would tile the page with
  // a visibly repeated photo. Image uniqueness is a standing requirement here —
  // a perceptual-hash audit (scripts/audit-image-dupes.mjs) gates it — so the
  // gallery drops a duplicate rather than displaying it twice.
  const seen = new Set<string>();
  const unique = (items ?? []).filter((c) => {
    const src = c.cover_image_url || getCoverForCampaign(c.category ?? undefined, c.slug);
    if (seen.has(src)) return false;
    seen.add(src);
    return true;
  });

  return (
    <PageBody>
      <PageHero
        eyebrow="GALLERY"
        title="What is being funded right now"
        lede="Every image below is a live campaign on CharitMe. Select any one to read the story behind it."
      />

      <Section id="grid" heading="Live campaigns" intro={unique.length > 0 ? `${unique.length} campaigns currently raising.` : undefined}>
        {items === null ? (
          <EmptyState
            icon="⚠️"
            title="We couldn't load the gallery just now"
            body="This is a problem on our side, not an empty platform. Please refresh in a moment."
            action={<Link href="/gallery" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
          />
        ) : unique.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="No live campaigns right now"
            body="Be the first to start one."
            action={<Link href="/create" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Start a fundraiser</Link>}
          />
        ) : (
          <ul
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
              gap: '14px',
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {unique.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.slug}`}
                  style={{
                    display: 'block',
                    position: 'relative',
                    aspectRatio: '4 / 3',
                    overflow: 'hidden',
                    borderRadius: 'var(--rl)',
                    border: '1px solid var(--b1)',
                    background: 'var(--s3)',
                    textDecoration: 'none',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={optimizedCoverUrl(c.cover_image_url || getCoverForCampaign(c.category ?? undefined, c.slug), 500)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* The title is the accessible name of the link and is always
                      rendered — the image carries alt="" because it is
                      decorative next to this text, so removing it would leave
                      the link with no name at all. */}
                  <span
                    style={{
                      position: 'absolute',
                      insetInline: 0,
                      bottom: 0,
                      padding: '26px 12px 10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      lineHeight: 1.35,
                      color: '#fff',
                      background: 'linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.55) 55%, transparent)',
                    }}
                  >
                    {c.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <CtaBand
        heading="See the stories behind them"
        body="Each campaign page shows who is raising, what for, and what has been funded so far."
        primary={{ label: 'Browse campaigns', href: '/campaigns' }}
        secondary={{ label: 'Success stories', href: '/success-stories' }}
      />
    </PageBody>
  );
}
