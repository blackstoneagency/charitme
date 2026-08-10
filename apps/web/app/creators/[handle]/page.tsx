import { boundedQuery } from '../../../lib/query-timeout';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DEFAULT_OG_IMAGE } from '../../../lib/public-routes';
import { createClient } from '../../../lib/supabase-server';
import { supabaseAdmin } from '../../../lib/supabase';
import JoinTierButton from './JoinTierButton';
import { formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';
import { getDisplayCover } from '../../../lib/photo-catalog';
import {
  redactPosts,
  isMembershipActive,
  type RawPost,
  type ViewerMembership,
} from '../../../lib/creator-posts';

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
  id: string;
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
  try {
  // supabaseAdmin is a Proxy that THROWS on property access when the env is
  // missing, so `.from(...)` throws before any query runs — which the error
  // check below cannot see. The `null` contract this loader already declares
  // is the correct degraded answer, so a throw takes the same path.

    const supabase = await createClient();
    const { data } = await supabase
      .from('creator_profiles')
      .select('id, user_id, handle, display_name, bio, hero_image_url, website_url, brand_color, accepts_tips, accepts_commissions')
      .eq('handle', handle)
      .maybeSingle();
    return (data as Creator | null) ?? null;
  
  } catch {
    return null;
  }
});

const getCampaigns = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaigns')
    .select('id, slug, title, tagline, category, cover_image_url, raised_amount, goal_amount, backer_count')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('raised_amount', { ascending: false })
    .limit(12);
  return data ?? [];
});

// Active tiers only. `public_membership_tiers_read` already restricts to
// `active`, but stating it here means the page does not silently change meaning
// if that policy is ever loosened.
const getTiers = cache(async (creatorProfileId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('membership_tiers')
    .select('id, title, description, amount_cents, interval, benefits')
    .eq('creator_profile_id', creatorProfileId)
    .eq('active', true)
    .order('amount_cents', { ascending: true });
  return data ?? [];
});

/**
 * The viewer's active memberships to THIS creator, plus the creator's tier
 * price/title maps that gating needs.
 *
 * Read through `supabaseAdmin` rather than the RLS client, deliberately and
 * narrowly: `member_subscriptions` has no policy that would let a viewer read
 * their own row here, and the alternative — loosening RLS — would widen access
 * for every other caller too. The query is pinned to `member_id = <the signed-in
 * user>`, so it cannot return anyone else's membership regardless.
 */
async function getViewerContext(creatorProfileId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: tierRows } = await boundedQuery(() => supabaseAdmin
    .from('membership_tiers')
    .select('id, title, amount_cents')
    .eq('creator_profile_id', creatorProfileId));

  const tiers = (tierRows ?? []) as { id: string; title: string; amount_cents: number }[];
  const tierPrices = new Map(tiers.map((t) => [t.id, t.amount_cents]));
  const tierTitles = new Map(tiers.map((t) => [t.id, t.title]));

  if (!user || tiers.length === 0) {
    return { userId: user?.id ?? null, memberships: [] as ViewerMembership[], tierPrices, tierTitles };
  }

  const { data: subs } = await boundedQuery(() => supabaseAdmin
    .from('member_subscriptions')
    .select('tier_id, status, current_period_end')
    .eq('member_id', user.id)
    .in('tier_id', tiers.map((t) => t.id)));

  const memberships: ViewerMembership[] = ((subs ?? []) as {
    tier_id: string;
    status: string;
    current_period_end: string | null;
  }[])
    .filter((s) => isMembershipActive(s))
    .map((s) => ({ tierId: s.tier_id, amountCents: tierPrices.get(s.tier_id) ?? 0 }));

  return { userId: user.id, memberships, tierPrices, tierTitles };
}

/** Newest first. Bodies are redacted before this leaves the server. */
async function getPosts(creatorProfileId: string): Promise<RawPost[]> {
  const { data } = await boundedQuery(() => supabaseAdmin
    .from('exclusive_posts')
    .select('id, title, body, visibility, minimum_tier_id, created_at')
    .eq('creator_profile_id', creatorProfileId)
    .order('created_at', { ascending: false })
    .limit(20));
  return (data ?? []) as RawPost[];
}

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
      images: creator.hero_image_url ? [creator.hero_image_url] : [{ url: DEFAULT_OG_IMAGE }],
    },
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = await getCreator(handle);
  if (!creator) notFound();

  const [campaigns, tiers, rawPosts, viewer] = await Promise.all([
    getCampaigns(creator.user_id),
    getTiers(creator.id),
    getPosts(creator.id),
    getViewerContext(creator.id),
  ]);
  // Redaction happens HERE, before the rows reach JSX — a locked body must never
  // enter the RSC payload, where view-source would read it straight back out.
  const posts = redactPosts(
    rawPosts,
    viewer.memberships,
    viewer.tierPrices,
    viewer.tierTitles,
    viewer.userId === creator.user_id,
  );
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

        <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
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

      {/* Membership tiers. Rendered only when the creator has published one — an
          empty "Memberships" heading would advertise a capability this page
          cannot offer.
          Each tier now carries a real Join button: /api/creators/tiers/subscribe
          creates the Stripe subscription and the webhook records it in
          `member_subscriptions`, which is what the post paywall reads. Until that
          route existed these were deliberately information-only, because a
          button that posts nowhere is worse than no button. */}
      {tiers.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--t1)', margin: '0 0 4px' }}>Memberships</h2>
          <p style={{ fontSize: 13.5, color: 'var(--t3)', margin: '0 0 18px' }}>
            {tiers.length} {tiers.length === 1 ? 'tier' : 'tiers'} from this creator
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
            {tiers.map((t) => (
              <li key={t.id} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--t1)' }}>{t.title}</h3>
                <p style={{ margin: '6px 0 10px', fontSize: 18, fontWeight: 900, color: accent }}>
                  {formatMoneyShort(t.amount_cents ?? 0, DEFAULT_CURRENCY)}
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t3)' }}>/{t.interval === 'year' ? 'year' : 'month'}</span>
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{t.description}</p>
                {Array.isArray(t.benefits) && t.benefits.length > 0 && (
                  <ul style={{ margin: '10px 0 0', padding: '0 0 0 16px', fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.7 }}>
                    {t.benefits.map((b: string, i: number) => <li key={i}>{b}</li>)}
                  </ul>
                )}
                {/* An existing member sees their state, not a second Join that
                    would create a duplicate subscription. */}
                {viewer.memberships.some((m) => m.tierId === t.id) ? (
                  <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 750, color: 'var(--green-text)' }}>
                    ✓ You are a member
                  </p>
                ) : (
                  <JoinTierButton tierId={t.id} label={`Join ${t.title}`} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Posts. Locked entries show a title, a date and a reason — never a
          truncated body, which would be a paywall that leaks a little. */}
      {posts.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--t1)', margin: '0 0 18px' }}>Posts</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            {posts.map((p) => (
              <li
                key={p.id}
                style={{
                  background: 'var(--s1)',
                  border: '1px solid var(--b1)',
                  borderRadius: 'var(--rl)',
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: 'var(--t1)' }}>{p.title}</h3>
                  <time
                    dateTime={p.created_at}
                    style={{ fontSize: 12, color: 'var(--t3)' }}
                  >
                    {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </time>
                </div>
                {p.locked ? (
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: 13,
                      color: 'var(--t3)',
                      display: 'flex', minWidth: 0,
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span aria-hidden="true">🔒</span>
                    {p.lockReason}
                  </p>
                ) : (
                  <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--t2)', whiteSpace: 'pre-wrap' }}>
                    {p.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getDisplayCover(c.cover_image_url, c.category, c.slug, 'creator-profile')}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block', maxWidth: '100%' }}
                    />
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
