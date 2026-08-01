import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../../lib/campaign-visibility';
import { CAUSES, getCause, type Cause } from '../../../lib/causes';
import { CampaignCard, CampaignGrid, type CampaignCardData } from '../../../components/CampaignCard';
import { EmptyState } from '../../../components/ui';
import { getTranslator } from '../../../lib/locale-server';

const PAGE_SIZE = 24;

export function generateStaticParams() {
  return CAUSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cause = getCause(slug);
  if (!cause) return { title: 'Cause not found' };

  return {
    title: `${cause.label} Fundraisers`,
    description: cause.blurb,
    alternates: { canonical: `https://www.charitme.com/causes/${cause.slug}` },
  };
}

/**
 * `null` means the query failed; `[]` means the cause genuinely has no live
 * campaigns. The page renders different copy for each — conflating them would
 * tell a visitor a cause is empty because our database was down.
 */
async function getCampaigns(cause: Cause): Promise<CampaignCardData[] | null> {
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
      // `.in()` is why multi-category causes have their own page: /campaigns
      // filters on a single category and would silently drop the rest.
      .in('category', [...cause.categories])
      .order('raised_amount', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) return null;
    return (data ?? []) as CampaignCardData[];
  } catch {
    return null;
  }
}

export default async function CausePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslator();
  const { slug } = await params;
  const cause = getCause(slug);
  if (!cause) notFound();

  const campaigns = await getCampaigns(cause);

  return (
    <div className="container" style={{ padding: '48px 0 72px' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: '18px' }}>
        <Link href="/causes" style={{ fontSize: '13px', color: 'var(--t3)', fontWeight: 650 }}>
          ← All causes
        </Link>
      </nav>

      <header style={{ maxWidth: '760px', marginBottom: '32px' }}>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, color: 'var(--t1)', lineHeight: 1.15, letterSpacing: '-.02em' }}>
          {cause.label}
        </h1>
        <p style={{ fontSize: '17px', color: 'var(--t3)', lineHeight: 1.6, marginTop: '12px' }}>
          {cause.blurb}
        </p>

        {/* The disclosure. Campaigns are not tagged at this granularity, so this
            page can only show its parent categories. Saying so is the difference
            between a filtered view and one that merely looks filtered — without
            it, Mental Health and Medical Research would show identical lists
            while each implying it had narrowed something. */}
        {cause.narrower && (
          <p
            style={{
              fontSize: '13px',
              color: 'var(--t3)',
              lineHeight: 1.55,
              marginTop: '16px',
              padding: '12px 14px',
              background: 'var(--s2)',
              border: '1px solid var(--b1)',
              borderRadius: 'var(--r)',
            }}
          >
            {t('cause.narrower_prefix')}{' '}
            <strong style={{ color: 'var(--t1)', fontWeight: 700 }}>
              {cause.categories.join(' and ')}
            </strong>{' '}
            {cause.categories.length === 1 ? t('cause.narrower_one_suffix') : t('cause.narrower_many_suffix')}
          </p>
        )}
      </header>

      {campaigns === null ? (
        <EmptyState
          icon="⚠️"
          title={t('cause.load_failed_title')}
          body={t('cause.load_failed_body')}
          action={
            <Link href={`/causes/${cause.slug}`} style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>
              {t('action.retry')}
            </Link>
          }
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="🌱"
          title={t('cause.empty_title', { cause: t(`nav.cause.${cause.slug}`) })}
          body={t('cause.empty_body')}
          action={
            <Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>
              {t('cause.browse_all')}
            </Link>
          }
        />
      ) : (
        <>
          <CampaignGrid>
            {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </CampaignGrid>

          {campaigns.length === PAGE_SIZE && (
            <div style={{ textAlign: 'center', marginTop: '36px' }}>
              <Link
                href={
                  cause.categories.length === 1
                    ? `/campaigns?category=${encodeURIComponent(cause.categories[0])}`
                    : '/campaigns'
                }
                style={{ padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
              >
                {t('cause.see_more')}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
