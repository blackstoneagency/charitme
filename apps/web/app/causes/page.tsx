import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { CAUSES, POPULAR_CAUSES, ALL_CAUSES_COLUMN, type Cause } from '../../lib/causes';
import { Card } from '../../components/ui';
import { getTranslator } from '../../lib/locale-server';

export const metadata: Metadata = {
  title: 'Browse Causes',
  description:
    'Explore every cause on CharitMe — from medical and education to animals, the environment, disaster relief, and more. Find a campaign to support today.',
  alternates: { canonical: 'https://www.charitme.com/causes' },
};

export const revalidate = 300;

/**
 * Live campaign count per cause.
 *
 * One HEAD count per distinct category, in parallel — `head: true` returns the
 * count with no rows at all, so the payload is constant no matter how large the
 * table gets. The obvious version (select every campaign's `category` and tally
 * in JS) reads one row per active campaign, which is exactly the unbounded scan
 * `__tests__/unbounded-reads.test.ts` exists to stop: free at 500 rows, a
 * timeout at 500,000, with no announcement in between.
 *
 * Returns an EMPTY map when the database is unreachable — deliberately not a
 * map of zeros. "0 campaigns" is a claim about the platform; a failed query is a
 * fact about us. The cards then render no count at all, rather than telling a
 * visitor a thriving cause is empty. That is the same bug as the homepage
 * showing "Raised on CharitMe $0" when its loader failed.
 */
async function getCauseCounts(): Promise<Map<string, number>> {
  try {
    const cols = await campaignColumns();
    const categories = [...new Set(CAUSES.flatMap((c) => c.categories))];

    const results = await Promise.all(
      categories.map(async (category) => {
        const { count, error } = await applyLiveFilters(
          supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }),
          cols,
        ).eq('category', category);
        return [category, error ? null : count ?? 0] as const;
      }),
    );

    // If any category failed we return nothing rather than a partial total that
    // would understate a cause without ever saying so.
    if (results.some(([, count]) => count === null)) return new Map();
    const perCategory = new Map(results as readonly (readonly [string, number])[]);

    return new Map(
      CAUSES.map((cause) => [
        cause.slug,
        cause.categories.reduce((sum, cat) => sum + (perCategory.get(cat) ?? 0), 0),
      ]),
    );
  } catch {
    return new Map();
  }
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function CauseCard({ cause, count, t }: { cause: Cause; count: number | undefined; t: Translate }) {
  // The cause NAME already has a translation key — the mega-menu renders the same
  // twenty names. Reusing `nav.cause.<slug>` keeps one string per cause instead of
  // a second copy that would drift from the menu.
  const label = t(`nav.cause.${cause.slug}`);
  return (
    <Link href={`/causes/${cause.slug}`} style={{ textDecoration: 'none' }}>
      <Card style={{ padding: '22px', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 750, color: 'var(--t1)', lineHeight: 1.3 }}>
          {label === `nav.cause.${cause.slug}` ? cause.label : label}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--t3)', lineHeight: 1.5, flex: 1 }}>{cause.blurb}</p>
        {/* Rendered only when the query actually returned. See getCauseCounts. */}
        {count !== undefined && (
          <span style={{ fontSize: '12px', color: 'var(--t4)', fontWeight: 650 }}>
            {count === 1 ? t('causes.live_one') : t('causes.live_many', { count })}
          </span>
        )}
      </Card>
    </Link>
  );
}

export default async function CausesPage() {
  const [counts, t] = await Promise.all([getCauseCounts(), getTranslator()]);

  return (
    <div className="container" style={{ padding: '48px 0 72px' }}>
      <header style={{ maxWidth: '720px', marginBottom: '40px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)', fontWeight: 800, color: 'var(--t1)', lineHeight: 1.15, letterSpacing: '-.02em' }}>
          {t('causes.page_title')}
        </h1>
        <p style={{ fontSize: '17px', color: 'var(--t3)', lineHeight: 1.6, marginTop: '14px' }}>
          {t('causes.page_intro')}
        </p>
      </header>

      <section aria-labelledby="popular-causes" style={{ marginBottom: '48px' }}>
        <h2 id="popular-causes" style={{ fontSize: '20px', fontWeight: 750, color: 'var(--t1)', marginBottom: '18px' }}>
          {t('nav.causes.popular')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '18px' }}>
          {POPULAR_CAUSES.map((cause) => (
            <CauseCard key={cause.slug} cause={cause} count={counts.get(cause.slug)} t={t} />
          ))}
        </div>
      </section>

      <section aria-labelledby="all-causes">
        <h2 id="all-causes" style={{ fontSize: '20px', fontWeight: 750, color: 'var(--t1)', marginBottom: '18px' }}>
          {t('nav.causes.all')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '18px' }}>
          {ALL_CAUSES_COLUMN.map((cause) => (
            <CauseCard key={cause.slug} cause={cause} count={counts.get(cause.slug)} t={t} />
          ))}
        </div>
      </section>

      <div style={{ marginTop: '48px', padding: '28px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', textAlign: 'center' }}>
        <h2 style={{ fontSize: '19px', fontWeight: 750, color: 'var(--t1)' }}>
          {t('causes.missing_title')}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--t3)', margin: '8px auto 18px', maxWidth: '520px', lineHeight: 1.55 }}>
          {t('causes.missing_body')}
        </p>
        <Link href="/create" className="cta-primary" style={{ display: 'inline-flex' }}>
          {t('nav.start_fundraiser')}
        </Link>
      </div>
    </div>
  );
}
