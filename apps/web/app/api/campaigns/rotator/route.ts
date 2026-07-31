import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { attachCampaignCurrencies } from '../../../../lib/home-data';
import { selectRotatorCampaigns } from '../../../../lib/featured';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Homepage hero rotator.
//
// ⚠️ TWO QUERIES, NOT ONE, and the reason is the whole requirement.
//
// This used to be a single `.limit(20)` ordered by (featured desc, raised desc),
// with the featured filter applied to the RESULT. That caps paid placements at
// whatever fits in the top 20 rows: a creator who paid to be featured but sits
// 21st by amount raised never appeared in the rotator at all, silently, forever.
// Filtering after a LIMIT is only ever correct when the limit is larger than the
// population, and nothing enforced that.
//
// So featured campaigns get their OWN query with no competition for slots, and
// the generic list is only ever a fallback for when no featured campaign is
// eligible.
//
// The ended/funded exclusions are split across SQL and JS on purpose:
//   • `deadline` is a plain column comparison, so it prunes in SQL and the row
//     budget is not spent on campaigns that will be discarded anyway.
//   • "raised >= goal" compares two COLUMNS, which PostgREST cannot express, so
//     it is applied in `selectRotatorCampaigns` after the fetch.
// Both are re-applied in that shared helper regardless, so a query that forgets
// one cannot leak an ineligible campaign into the hero.
// ─────────────────────────────────────────────────────────────────────────────

const SELECT =
  'id,slug,title,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,featured,profiles:user_id(full_name)';

// Every paid placement rotates, so there is no product cap here — this is only a
// guard against an unbounded query. If it is ever reached, that is a good problem
// and the rotator UI is the thing to revisit, not this number.
const FEATURED_CEILING = 200;
const FALLBACK_LIMIT = 20;

type Raw = {
  id: string; slug: string; title: string; category: string | null;
  cover_image_url: string | null; featured: boolean | null;
  goal_amount: number; raised_amount: number; backer_count: number;
  trust_status: string | null; campaign_health_score: number | null;
  deadline: string | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
};

function baseQuery(nowIso: string) {
  return supabaseAdmin
    .from('campaigns')
    .select(SELECT)
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .not('cover_image_url', 'is', null)
    .neq('cover_image_url', '')
    // Ended campaigns are dropped in SQL. A null deadline means "runs
    // indefinitely" and must stay — most campaigns have no deadline at all.
    .or(`deadline.is.null,deadline.gt.${nowIso}`);
}

function normalize(rows: Raw[]) {
  return rows
    .filter((c) => c.cover_image_url?.startsWith('http'))
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      category: c.category,
      cover_image_url: c.cover_image_url!,
      goal_amount: c.goal_amount,
      raised_amount: c.raised_amount,
      backer_count: c.backer_count,
      trust_status: c.trust_status,
      campaign_health_score: c.campaign_health_score,
      deadline: c.deadline,
      featured: c.featured ?? false,
      organizer_name: Array.isArray(c.profiles)
        ? (c.profiles[0]?.full_name ?? null)
        : ((c.profiles as { full_name: string | null } | null)?.full_name ?? null),
    }));
}

export async function GET() {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const [featuredResult, fallbackResult, statsResult] = await Promise.all([
    // Every featured campaign, ranked among themselves only.
    baseQuery(nowIso)
      .eq('featured', true)
      .order('raised_amount', { ascending: false })
      .limit(FEATURED_CEILING),

    // Fallback pool, used only when no featured campaign is eligible.
    baseQuery(nowIso)
      .order('raised_amount', { ascending: false })
      .limit(FALLBACK_LIMIT),

    // Platform-level stats for the "Live" badge
    supabaseAdmin
      .from('donations')
      .select('created_at', { count: 'exact' })
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  if (featuredResult.error && fallbackResult.error) {
    return NextResponse.json({ error: 'Unable to load featured campaigns', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  // A failure on ONE query degrades to the other rather than blanking the hero.
  const featured = normalize((featuredResult.data ?? []) as Raw[]);
  const fallback = normalize((fallbackResult.data ?? []) as Raw[]);

  // `selectRotatorCampaigns` re-applies both exclusions and prefers featured, so
  // passing the two lists together yields: all eligible featured, else eligible
  // fallback. The featured rows are first so they win that preference.
  const selected = selectRotatorCampaigns([...featured, ...fallback], now);
  const campaigns = await attachCampaignCurrencies(selected);

  // Last donation timestamp for the live badge
  type DonationRow = { created_at: string };
  const lastDonationAt = ((statsResult.data ?? []) as DonationRow[])[0]?.created_at ?? null;
  const totalDonations = statsResult.count ?? 0;

  return NextResponse.json({ campaigns, lastDonationAt, totalDonations });
}
