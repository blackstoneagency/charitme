import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '../../../lib/supabase-server';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Public creator page.
//
// `creator_profiles` held 500 rows and ZERO readers — `npm run audit:orphan-tables`
// is what surfaced it, the same way it surfaced peer_fundraisers. The rows were
// seeded, the RLS policy was written, and nothing ever rendered them.
//
// ⚠️ Reads through the RLS-ENFORCED client, not `supabaseAdmin`, and that is a
// deliberate departure from the other public detail pages. The policy
// `public_creator_profiles_read` is not a formality — it defines what "public
// creator" MEANS here:
//
//     EXISTS (select 1 from campaigns c
//             where c.user_id = creator_profiles.user_id
//               and c.deleted_at is null
//               and c.status = 'active'
//               and c.visibility = 'public')
//
// Measured against production: 350 of the 500 rows satisfy it. Using
// `supabaseAdmin` here would bypass the policy and publish the other 150 —
// creators with no active public campaign — which is a visibility change wearing
// the costume of a convention.
//
// No `loading.tsx` in this segment, on purpose: a Suspense boundary lets Next
// commit a 200 before the body runs, so `notFound()` would render the 404 UI
// under a 200 status. That soft-404 bug has already been fixed on seven routes
// in this repo; this one avoids introducing an eighth.
// ─────────────────────────────────────────────────────────────────────────────

type Creator = {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  hero_image_url: string | null;
  website_url: string | null;
  brand_color: string | null;
  accepts_tips: boolean;
  accepts_commissions: boolean;
};

/** Memoized so generateMetadata and the page body share one query per request. */
const getCreator = cache(async (handle: string): Promise<Creator | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('creator_profiles')
    .select('user_id, handle, display_name, bio, hero_image_url, website_url, brand_color, accepts_tips, accepts_commissions')
    .eq('handle', handle)
    .maybeSingle();
  return (data as Creator | null) ?? null;
});

const getCampaigns = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaigns')
    .select('id, slug, title, tagline, cover_image_url, raised_amount, goal_amount, backer_count')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('raised_amount', { ascending: false })
    .limit(12);
  return data ?? [];
});

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const creator = await getCreator(handle);
  if (!creator) return { title: 'Creator not found' };
  const name = creator.display_name;
  return {
    title: `${name} on CharitMe`,
    description: creator.bio ?? `${name} raises money for causes on CharitMe.`,
    openGraph: {
      title: `${name} on CharitMe`,
      description: creator.bio ?? `${name} raises money for causes on CharitMe.`,
      images: creator.hero_image_url ? [creator.hero_image_url] : undefined,
    },
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = await getCreator(handle);
  if (!creator) notFound();

  const campaigns = await getCampaigns(creator.user_id);
  const accent = creator.brand_color || '#059669';
  const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount ?? 0), 0);

  return (
    <main id="main-content" style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 56px' }}>
      {/* Hero — falls back to the creator's brand colour when they have no image,
          rather than rendering a broken/empty band. */}
      <div
        style={{
          height: 180,
          borderRadius: 'var(--rl)',
          margin: '24px 0 0',
          background: creator.hero_image_url
            ? `center/cover no-repeat url(${JSON.stringify(creator.hero_image_url)})`
            : `linear-gradient(120deg, ${accent}, var(--s3))`,
        }}
        role="presentation"
      />

      <header style={{ padding: '20px 4px 8px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.02em', margin: 0, color: 'var(--t1)' }}>
          {creator.display_name}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--t3)' }}>@{creator.handle}</p>

        {creator.bio && (
          <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.6, color: 'var(--t2)', maxWidth: 680 }}>
            {creator.bio}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
          {creator.website_url && (
            <a
              href={creator.website_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--violet-ink)' }}
            >
              Website ↗
            </a>
          )}
          {/* These two are stated only when true. A "does not accept tips" badge
              would be noise, and inventing a Tip button would be worse: there is
              no tipping surface wired to `creator_tips` yet. */}
          {creator.accepts_tips && (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>Accepts tips</span>
          )}
          {creator.accepts_commissions && (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>Open for commissions</span>
          )}
        </div>
      </header>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--t1)', margin: '0 0 4px' }}>
          Campaigns
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: '0 0 18px' }}>
          {campaigns.length === 0
            ? 'No active campaigns right now.'
            : `${campaigns.length} active ${campaigns.length === 1 ? 'campaign' : 'campaigns'}`}
          {totalRaised > 0 && ` — ${formatMoneyShort(totalRaised, DEFAULT_CURRENCY)} raised`}
        </p>

        {campaigns.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: 16,
            }}
          >
            {campaigns.map((c) => {
              const goal = c.goal_amount ?? 0;
              const pct = goal > 0 ? Math.min(100, Math.round(((c.raised_amount ?? 0) / goal) * 100)) : 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/campaigns/${c.slug}`}
                    style={{
                      display: 'block',
                      background: 'var(--s1)',
                      border: '1px solid var(--b1)',
                      borderRadius: 'var(--rl)',
                      overflow: 'hidden',
                      textDecoration: 'none',
                      height: '100%',
                    }}
                  >
                    {c.cover_image_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.cover_image_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', maxWidth: '100%' }}
                      />
                    )}
                    <div style={{ padding: 14 }}>
                      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: 'var(--t1)', lineHeight: 1.35 }}>
                        {c.title}
                      </h3>
                      {c.tagline && (
                        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.45 }}>
                          {c.tagline}
                        </p>
                      )}
                      <div
                        style={{ height: 5, borderRadius: 99, background: 'var(--s3)', overflow: 'hidden', margin: '12px 0 8px' }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${pct}% of goal raised`}
                      >
                        <div style={{ width: `${pct}%`, height: '100%', background: accent }} />
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--t2)' }}>
                        {formatMoneyShort(c.raised_amount ?? 0, DEFAULT_CURRENCY)} raised
                        {goal > 0 && <span style={{ fontWeight: 400, color: 'var(--t3)' }}> of {formatMoneyShort(goal, DEFAULT_CURRENCY)}</span>}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
