import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { boundedQuery } from '../../../lib/query-timeout';
import { formatMoneyCompact } from '@shared/currencies';
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
/**
 * Headline numbers for a cause — every one MEASURED, none invented.
 *
 * The design for this page shows figures like "125K+ Youth Impacted" and
 * "68K+ Athletes Supported". Nothing in the schema records either, and this repo
 * has a standing rule against presenting a number it has not measured, so those
 * are not reproduced. What IS renderable from real rows is shown instead, with
 * labels that say exactly what was counted.
 *
 * `null` means the read failed. That renders as an em dash, never as 0 — "no
 * fundraisers yet" and "we could not count them" are opposite claims.
 */
interface CauseStats {
  fundraisers: number | null;
  raisedCents: number | null;
  supporters: number | null;
  communities: number | null;
}

const STATS_SCAN_LIMIT = 1000;

async function getCauseStats(cause: Cause): Promise<CauseStats> {
  const empty: CauseStats = { fundraisers: null, raisedCents: null, supporters: null, communities: null };
  try {
    const cols = await campaignColumns();
    const { data, error } = await boundedQuery(
      applyLiveFilters(
        supabaseAdmin.from('campaigns').select('raised_amount, backer_count, location'),
        cols,
      )
        .in('category', cause.categories as unknown as string[])
        .limit(STATS_SCAN_LIMIT),
    );
    if (error || !data) return empty;

    const rows = data as { raised_amount: number | null; backer_count: number | null; location: string | null }[];
    const communities = new Set(
      rows.map((r) => (r.location ?? '').trim().toLowerCase()).filter(Boolean),
    );
    return {
      fundraisers: rows.length,
      raisedCents: rows.reduce((sum, r) => sum + (r.raised_amount ?? 0), 0),
      supporters: rows.reduce((sum, r) => sum + (r.backer_count ?? 0), 0),
      communities: communities.size,
    };
  } catch {
    return empty;
  }
}

async function getCampaigns(cause: Cause): Promise<CampaignCardData[] | null> {
  try {
    const cols = await campaignColumns();
    // Bounded, like every other discovery read. A timeout returns
    // `{ data: null, error }`, which takes the `null` branch below — and the page
    // already renders that as "we could not load these", not as "none exist".
    const { data, error } = await boundedQuery(
      applyLiveFilters(
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
        .limit(PAGE_SIZE),
    );

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

  const [campaigns, stats] = await Promise.all([getCampaigns(cause), getCauseStats(cause)]);

  return (
    <div className="container" style={{ padding: '48px 0 72px' }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: '18px' }}>
        <Link href="/causes" style={{ display: 'inline-flex', alignItems: 'center', minHeight: '24px', fontSize: '13px', color: 'var(--t3)', fontWeight: 650 }}>
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
        {cause.tagline && (
          <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--brand-text)', margin: '10px 0 0' }}>
            {cause.tagline}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '22px' }}>
          <Link href="/campaigns" className="cta-primary" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0 22px', borderRadius: 'var(--r)', fontWeight: 700, textDecoration: 'none' }}>
            Donate now
          </Link>
          <Link href="/create" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontWeight: 700, textDecoration: 'none' }}>
            Start a fundraiser →
          </Link>
        </div>

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

      {/* Measured figures only. `null` renders as an em dash — a failed count and
          a real zero are different facts, and this repo has shipped the bug of
          conflating them before. */}
      <section aria-label={`${cause.label} at a glance`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '14px', margin: '0 0 34px' }}>
        {[
          { label: 'Active fundraisers', value: stats.fundraisers === null ? '—' : stats.fundraisers.toLocaleString() },
          { label: 'Raised through CharitMe', value: stats.raisedCents === null ? '—' : formatMoneyCompact(stats.raisedCents, 'usd') },
          { label: 'Supporters', value: stats.supporters === null ? '—' : stats.supporters.toLocaleString() },
          { label: 'Communities', value: stats.communities === null ? '—' : stats.communities.toLocaleString() },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: '18px 16px' }}>
            <div style={{ fontSize: '26px', fontWeight: 850, color: 'var(--t1)', lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </section>

      {cause.helps && cause.helps.length > 0 && (
        <section aria-labelledby="how-support-helps" style={{ margin: '0 0 38px' }}>
          <h2 id="how-support-helps" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', margin: '0 0 16px' }}>
            How your support helps
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '14px' }}>
            {cause.helps.map((h) => (
              <li key={h.title} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: '18px 16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 750, color: 'var(--t1)', margin: '0 0 6px' }}>{h.title}</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--t3)', lineHeight: 1.55, margin: 0 }}>{h.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The cause hub. Each link is the EXISTING page scoped by `?cause=`, not a
          new per-cause page — twenty causes times six pages would be 120 routes
          that drift apart. Campaigns and volunteering already accepted a cause;
          events and teams gained it in this change. */}
      <nav aria-label={`More in ${cause.label}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '0 0 32px' }}>
        {[
          { href: `/campaigns?cause=${cause.slug}`, label: 'All campaigns' },
          { href: `/events?cause=${cause.slug}`, label: 'Events' },
          { href: `/teams?cause=${cause.slug}`, label: 'Teams & clubs' },
          { href: `/volunteer?cause=${cause.slug}`, label: 'Volunteer' },
          { href: '/success-stories', label: 'Stories' },
          { href: '/impact', label: 'Impact reports' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '0 16px',
              borderRadius: '999px', border: '1px solid var(--b2)', background: 'var(--s1)',
              color: 'var(--t1)', fontSize: '14px', fontWeight: 650, textDecoration: 'none',
            }}
          >
            {l.label}
          </Link>
        ))}
      </nav>

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
