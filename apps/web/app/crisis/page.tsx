import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../lib/supabase';
import { boundedQuery } from '../../lib/query-timeout';
import { campaignColumns, applyLiveFilters } from '../../lib/campaign-visibility';
import { ProgressBar, Card, EmptyState } from '../../components/ui';
import { formatCents } from '../../lib/stripe';
import { getCoverForCampaign } from '../../lib/photo-catalog';
import { optimizedCoverUrl } from '../../lib/img-optimize';

// ─────────────────────────────────────────────────────────────────────────────
// Crisis relief hub.
//
// GoFundMe surfaces a curated emergency landing page; CharitMe had the
// `Emergency` category but no hub, so the only way in was
// `/campaigns?category=Emergency` — a query string nobody can say out loud.
//
// This exists for the one thing a filter cannot do: be a SHAREABLE URL during a
// disaster. `charitme.com/crisis` fits in a text message, a news article, or a
// press release while an event is unfolding. That is the whole justification —
// so this stays a focused hub and deliberately does NOT rebuild the discovery
// UI (search, sort, pagination, facets). It shows what is urgent now and hands
// off to the full filtered list for everything else.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Crisis Relief — Urgent Fundraisers | CharitMe',
  description:
    'Active emergency and disaster-relief fundraisers on CharitMe. Every campaign is verified against the same trust checks as the rest of the platform.',
  alternates: { canonical: 'https://www.charitme.com/crisis' },
};

export const dynamic = 'force-dynamic';

interface CrisisCampaign {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  cover_image_url: string | null;
  goal_amount: number;
  raised_amount: number;
  backer_count: number;
  location: string | null;
  created_at: string;
}

/**
 * Newest first, not highest-raised. A crisis hub that ranks by amount raised
 * buries the fundraiser that started this morning — which is the one a visitor
 * arriving from a news story is looking for.
 *
 * `loadFailed` is returned rather than swallowed: an empty grid and a failed
 * read look identical to a visitor, and telling them "no active appeals" when
 * the database is down is the failure mode this repo keeps recording.
 */
async function getCrisisCampaigns(): Promise<{ rows: CrisisCampaign[]; loadFailed: boolean }> {
  try {
    const cols = await campaignColumns();
    // Bounded: a stalled database used to hold this page for ~7s with no
    // ceiling. A timeout synthesises `{ data: null, error }`, so it takes the
    // `loadFailed` branch below — which already says "we could not load these"
    // rather than "there are no appeals".
    const { data, error } = await boundedQuery(
      applyLiveFilters(
        supabaseAdmin
          .from('campaigns')
          .select(
            'id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, location, created_at',
          ),
        cols,
      )
        .eq('category', 'Emergency')
        .order('created_at', { ascending: false })
        .limit(24),
    );

    if (error) return { rows: [], loadFailed: true };
    return { rows: (data ?? []) as CrisisCampaign[], loadFailed: false };
  } catch {
    return { rows: [], loadFailed: true };
  }
}

export default async function CrisisPage() {
  const { rows, loadFailed } = await getCrisisCampaigns();

  return (
    <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 64px' }}>
      <header style={{ marginBottom: 28 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--red-text)',
            marginBottom: 10,
          }}
        >
          Crisis relief
        </span>
        <h1 style={{ fontSize: 36, lineHeight: 1.15, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          Help when it is needed most
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: 0, maxWidth: 640 }}>
          Active emergency and disaster-relief fundraisers, newest first. Every one carries the
          same verification and payout protections as the rest of CharitMe, and the platform takes{' '}
          <strong>0%</strong> of your donation.
        </p>
      </header>

      {loadFailed && (
        <div
          role="alert"
          style={{
            border: '1px solid var(--b1)',
            background: 'var(--s2)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: 'var(--t2)',
          }}
        >
          Emergency appeals could not be loaded just now. This is a temporary problem on our side —
          it does not mean there are no active appeals. Please try again shortly.
        </div>
      )}

      {!loadFailed && rows.length === 0 && (
        <EmptyState
          title="No active emergency appeals"
          body="Nothing is running under the Emergency category right now. Browse every live fundraiser instead."
        />
      )}

      {rows.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
            gap: 20,
          }}
        >
          {rows.map((c) => {
            const cover = optimizedCoverUrl(c.cover_image_url ?? getCoverForCampaign('Emergency', c.id), 600);
            return (
              <li key={c.id}>
                <Card style={{ padding: 0, overflow: 'hidden', height: '100%' }}>
                  <Link href={`/campaigns/${c.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{ padding: 16 }}>
                      <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px', color: 'var(--t1)', lineHeight: 1.35 }}>
                        {c.title}
                      </h2>
                      {c.location && (
                        <p style={{ fontSize: 12, color: 'var(--t3)', margin: '0 0 10px' }}>{c.location}</p>
                      )}
                      <ProgressBar value={c.raised_amount} max={c.goal_amount > 0 ? c.goal_amount : 1} />
                      <p style={{ fontSize: 13, color: 'var(--t2)', margin: '8px 0 0' }}>
                        <strong style={{ color: 'var(--t1)' }}>{formatCents(c.raised_amount)}</strong> raised
                        {c.backer_count > 0 && ` · ${c.backer_count} donor${c.backer_count === 1 ? '' : 's'}`}
                      </p>
                    </div>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p style={{ marginTop: 28, fontSize: 14 }}>
        <Link href="/campaigns?category=Emergency" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
          Search and filter every emergency fundraiser →
        </Link>
      </p>
    </main>
  );
}
