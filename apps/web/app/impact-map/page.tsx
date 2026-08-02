import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '\.\./\.\./lib/query-timeout';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { EmptyState } from '../../components/ui';
import { PageBody, PageHero, Section, CardGrid, StatCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Impact Map',
  description:
    'Where CharitMe campaigns are running and what they are funding — counted from live campaign data, by place and by cause.',
  alternates: { canonical: 'https://www.charitme.com/impact-map' },
};

export const revalidate = 900;

interface MapData {
  places: { location: string; count: number }[];
  categories: { category: string; count: number }[];
  totalPlaces: number;
  supportedCountries: number | null;
}

/**
 * Where campaigns are running, and what they fund.
 *
 * The design shows a world map with country pins and headline figures — "120+
 * Countries Reached", "2.3M+ Lives Changed", "$85M+ Total Impact". None of those
 * is derivable from this schema, and the reason matters:
 *
 *   • `campaigns.location` is FREE TEXT ("Nashville, TN", "London, UK"). It
 *     cannot be resolved to countries without a geocoding step that does not
 *     exist, so pins would either be invented or silently wrong.
 *   • `supported_countries` records where CharitMe can legally accept donations
 *     and pay out. That is emphatically not the same as where impact happened,
 *     and labelling it "countries reached" would be a false claim.
 *   • "Lives changed" has no column behind it anywhere.
 *
 * So this page reports what IS true — campaigns by place and by cause, counted —
 * and says plainly what it cannot show. A pin map implying verified per-country
 * impact would be the most convincing false statistic on the site.
 */
async function getMapData(): Promise<MapData | null> {
  try {
    const cols = await campaignColumns();

    const [locRes, countryRes] = await Promise.all([
      // Bounded read of just the two columns needed to group.
      boundedQuery(
        applyLiveFilters(
          supabaseAdmin.from('campaigns').select('location, category'),
          cols,
        ).limit(5000)
      ),
      boundedQuery(
        supabaseAdmin.from('supported_countries').select('id', { count: 'exact', head: true })
      ),
    ]);

    if (locRes.error) return null;
    const rows = (locRes.data ?? []) as { location: string | null; category: string | null }[];

    const byPlace = new Map<string, number>();
    const byCategory = new Map<string, number>();
    for (const r of rows) {
      const loc = r.location?.trim();
      if (loc) byPlace.set(loc, (byPlace.get(loc) ?? 0) + 1);
      if (r.category) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
    }

    return {
      places: [...byPlace.entries()]
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 24),
      categories: (CAMPAIGN_CATEGORIES as readonly string[])
        .map((category) => ({ category, count: byCategory.get(category) ?? 0 }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
      totalPlaces: byPlace.size,
      supportedCountries: countryRes.error ? null : countryRes.count ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function ImpactMapPage() {
  const data = await getMapData();
  const dash = '—';
  const maxPlace = data?.places[0]?.count ?? 1;
  const maxCat = data?.categories[0]?.count ?? 1;

  return (
    <PageBody>
      <PageHero
        eyebrow="IMPACT"
        title="Where CharitMe is working"
        lede="Every figure on this page is counted from live campaigns. Where a number cannot be measured, it is not shown — see the note at the bottom for what that means and why."
      />

      {data === null ? (
        <EmptyState
          icon="⚠️"
          title="We couldn't load impact data just now"
          body="This is a problem on our side, not an absence of impact. Please refresh in a moment."
          action={<Link href="/impact-map" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Try again</Link>}
        />
      ) : (
        <>
          <Section id="figures" heading="What we can count">
            <CardGrid min={200}>
              <StatCard value={data.totalPlaces > 0 ? data.totalPlaces.toLocaleString() : dash} label="Distinct places with a live campaign" />
              <StatCard value={data.supportedCountries != null ? data.supportedCountries.toLocaleString() : dash} label="Countries we can pay out to" />
              <StatCard value={data.categories.length > 0 ? String(data.categories.length) : dash} label="Causes currently being funded" />
            </CardGrid>
          </Section>

          <Section id="places" heading="Campaigns by place" intro="The places with the most live campaigns right now, as organisers entered them.">
            {data.places.length === 0 ? (
              <EmptyState
                icon="🌍"
                title="No locations recorded yet"
                body="Campaigns show up here once organisers add a location."
                action={<Link href="/campaigns" style={{ fontSize: '14px', color: 'var(--green-text)', fontWeight: 600 }}>Browse campaigns</Link>}
              />
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' }}>
                {data.places.map((p) => (
                  <li key={p.location}>
                    <Link
                      href={`/campaigns?location=${encodeURIComponent(p.location)}`}
                      style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', textDecoration: 'none', minHeight: '24px' }}
                    >
                      <span style={{ flex: 1, fontSize: '14px', fontWeight: 650, color: 'var(--t1)' }}>{p.location}</span>
                      <span aria-hidden="true" style={{ width: '96px', height: '6px', borderRadius: '3px', background: 'var(--s3)', overflow: 'hidden', flexShrink: 0 }}>
                        <span style={{ display: 'block', height: '100%', width: `${Math.max(6, (p.count / maxPlace) * 100)}%`, background: 'var(--green-btn, var(--green))' }} />
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t3)', minWidth: '34px', textAlign: 'right' }}>{p.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="causes" heading="Campaigns by cause" intro="What the live campaigns are actually funding.">
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' }}>
              {data.categories.map((c) => (
                <li key={c.category}>
                  <Link
                    href={`/campaigns?category=${encodeURIComponent(c.category)}`}
                    style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', textDecoration: 'none', minHeight: '24px' }}
                  >
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 650, color: 'var(--t1)' }}>{c.category}</span>
                    <span aria-hidden="true" style={{ width: '96px', height: '6px', borderRadius: '3px', background: 'var(--s3)', overflow: 'hidden', flexShrink: 0 }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.max(6, (c.count / maxCat) * 100)}%`, background: 'var(--green-btn, var(--green))' }} />
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t3)', minWidth: '34px', textAlign: 'right' }}>{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <Section id="method" heading="What this page does not show, and why">
        <div style={{ padding: '22px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: '720px' }}>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, margin: 0 }}>
            There is no world map with country pins here, and no “lives changed” figure. Campaign
            locations are entered as free text — “Nashville, TN”, “London, UK” — so resolving them
            to countries would require geocoding we do not do, and pins would be either invented or
            quietly wrong. The countries figure above is where CharitMe can legally{' '}
            <strong style={{ color: 'var(--t1)' }}>accept donations and pay out</strong>, which is
            not the same as where impact happened. And nothing in our data records lives changed.
          </p>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, marginTop: '12px' }}>
            We would rather show three real numbers than five convincing ones. The{' '}
            <Link href="/reports" style={{ color: 'var(--green-text)', fontWeight: 650 }}>reports page</Link>{' '}
            explains how every published figure is produced.
          </p>
        </div>
      </Section>

      <CtaBand
        heading="Support a campaign near you"
        body="Browse by place or by cause and find something close to home."
        primary={{ label: 'Find campaigns nearby', href: '/nearby' }}
        secondary={{ label: 'Explore causes', href: '/causes' }}
      />
    </PageBody>
  );
}
