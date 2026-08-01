import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CreatorClient, type CreatorProfile, type Tier, type Post } from './_components/CreatorClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Creator Page | CharitMe',
};

// ─────────────────────────────────────────────────────────────────────────────
// The screen that makes the creator module reachable.
//
// `/creators/[handle]` (public read) and `/api/creators/tiers` (write) both
// shipped, but nothing in the product could create a `creator_profiles` row, so
// the tiers endpoint returned 409 NO_CREATOR_PROFILE for every real account and
// `membership_tiers` sat at 0 rows in production. This page plus
// `/api/creators/profile` closes that loop.
//
// Reads with `supabaseAdmin` scoped by `user_id`, matching the other dashboard
// pages: the caller is always looking at their own row, including the inactive
// tiers the public RLS policy hides.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchData(
  userId: string,
): Promise<{ profile: CreatorProfile | null; tiers: Tier[]; posts: Post[] }> {
  try {
    const { data: profile } = await supabaseAdmin
      .from('creator_profiles')
      .select('id, handle, display_name, bio, hero_image_url, website_url, brand_color, accepts_tips, accepts_commissions')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) return { profile: null, tiers: [], posts: [] };

    const [{ data: tiers }, { data: posts }] = await Promise.all([
      supabaseAdmin
        .from('membership_tiers')
        .select('id, title, description, amount_cents, interval, benefits, active')
        .eq('creator_profile_id', (profile as CreatorProfile).id)
        .order('amount_cents', { ascending: true }),
      supabaseAdmin
        .from('exclusive_posts')
        .select('id, title, body, visibility, minimum_tier_id, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    return {
      profile: profile as CreatorProfile,
      tiers: (tiers ?? []) as Tier[],
      posts: (posts ?? []) as Post[],
    };
  } catch {
    return { profile: null, tiers: [], posts: [] };
  }
}

export default async function CreatorDashboardPage() {
  const user = await requireUser();
  const { profile, tiers, posts } = await fetchData(user.id);

  return (
    <CharitMeShell active="Creator Page">
      <TopBar
        title="Creator Page"
        subtitle="Your public creator profile and membership tiers."
      />
      <div className="kf-content-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className="kf-content-main">
          <CreatorClient initialProfile={profile} initialTiers={tiers} initialPosts={posts} />
        </div>
      </div>
    </CharitMeShell>
  );
}
