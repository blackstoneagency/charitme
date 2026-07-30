import { supabaseAdmin } from './supabase';
import { boundedQuery } from './query-timeout';
import { campaignColumns, applyLiveFilters } from './campaign-visibility';
import { attachCampaignCurrencies } from './home-data';

export type LeaderboardPeriod = 'all' | 'month' | 'week';
export const LEADERBOARD_PERIODS: LeaderboardPeriod[] = ['all', 'month', 'week'];

export interface LeaderboardCampaign {
  rank: number;
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  coverImageUrl: string | null;
  goalAmount: number;
  raisedAmount: number;
  backerCount: number;
  category: string;
  trustStatus: string;
  nonprofitVerified: boolean;
  location: string | null;
  organizerName: string;
  organizerAvatarUrl: string | null;
  currency?: string | null;
  /**
   * Raised WITHIN the selected window. Present only for 'month'/'week'.
   *
   * It has to travel with the row rather than being derived in the UI: once the
   * ranking is "top campaigns this week", `raisedAmount` (a lifetime total) no
   * longer explains the order — a campaign can sit at #1 for the week with the
   * smallest lifetime figure on screen. Showing the lifetime number under a
   * "This week" heading is the shape of dishonest metric this repo keeps
   * finding, so the period total is carried and rendered instead.
   */
  periodRaisedCents?: number;
}

export interface LeaderboardDonor {
  rank: number;
  donorId: string;
  name: string;
  avatarUrl: string | null;
  totalCents: number;
  donationCount: number;
  showPublicProfile: boolean;
}

type ProfileLite = { full_name?: string | null; avatar_url?: string | null };
function asProfile(value: unknown): ProfileLite {
  if (Array.isArray(value)) return (value[0] ?? {}) as ProfileLite;
  return (value ?? {}) as ProfileLite;
}

const DONOR_SCAN_LIMIT = 5000;

export function periodCutoff(period: LeaderboardPeriod): string | null {
  const now = Date.now();
  if (period === 'week') return new Date(now - 7 * 86_400_000).toISOString();
  if (period === 'month') return new Date(now - 30 * 86_400_000).toISOString();
  return null;
}

/**
 * Campaign rows for a set of ids, with the same live-visibility filters the
 * all-time query uses. Shared so the period path cannot drift into publishing a
 * campaign the all-time path would hide.
 */
async function campaignsByIds(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  if (ids.length === 0) return new Map();
  const cols = await campaignColumns();
  const { data, error } = await boundedQuery(
    applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, category, trust_status, nonprofit_verified, location, profiles:user_id(full_name, avatar_url)'),
      cols,
    ).in('id', ids),
  );
  if (error || !data) return new Map();
  return new Map(data.map((c) => [c.id as string, c as Record<string, unknown>]));
}

function toLeaderboardCampaign(c: Record<string, unknown>, rank: number): LeaderboardCampaign {
  const profile = asProfile(c.profiles);
  return {
    rank,
    id: c.id as string,
    slug: c.slug as string,
    title: c.title as string,
    tagline: (c.tagline as string | null) ?? null,
    coverImageUrl: (c.cover_image_url as string | null) ?? null,
    goalAmount: c.goal_amount as number,
    raisedAmount: c.raised_amount as number,
    backerCount: c.backer_count as number,
    category: c.category as string,
    trustStatus: c.trust_status as string,
    nonprofitVerified: c.nonprofit_verified as boolean,
    location: (c.location as string | null) ?? null,
    organizerName: (profile.full_name as string) || 'CharitMe Organizer',
    organizerAvatarUrl: profile.avatar_url ?? null,
  };
}

/**
 * Top campaigns for a window, ranked by money raised INSIDE it.
 *
 * `campaigns.raised_amount` is a lifetime total, so it cannot answer this — a
 * campaign that raised everything last year would top "This week". The ranking
 * therefore comes from `donations` grouped by `campaign_id`, mirroring
 * `getTopDonors` exactly, including its `DONOR_SCAN_LIMIT` bound and the reason
 * for it: a bounded, occasionally-approximate leaderboard is an acceptable
 * degraded state; an unbounded scan on a public page is not.
 */
export async function getTopCampaignsForPeriod(
  period: LeaderboardPeriod,
  limit = 20,
): Promise<LeaderboardCampaign[]> {
  const cutoff = periodCutoff(period);
  if (!cutoff) return getTopCampaigns(limit);

  const { data, error } = await boundedQuery(
    supabaseAdmin
      .from('donations')
      .select('campaign_id, amount_cents, created_at')
      .eq('status', 'completed')
      .not('campaign_id', 'is', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(DONOR_SCAN_LIMIT),
  );
  if (error || !data) return [];

  const totals = new Map<string, number>();
  for (const row of data) {
    const id = row.campaign_id as string | null;
    if (!id) continue;
    totals.set(id, (totals.get(id) ?? 0) + (row.amount_cents as number));
  }

  // Over-fetch before the visibility filter, then trim to `limit` after.
  //
  // Taking exactly `limit` first under-fills the list, and the symptom is
  // nonsense: measured against fixtures, 'month' returned 14 campaigns while
  // 'week' returned 16 — impossible, since the 30-day window strictly contains
  // the 7-day one. Both had ranked their top 20 by raw total and then dropped
  // whichever of those were hidden or deleted, and the month set simply happened
  // to contain more of them. The aggregation is already in memory, so widening
  // the candidate set costs one larger `in (…)` and nothing else.
  const candidates = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 3);
  if (candidates.length === 0) return [];

  // Fetch AFTER ranking, then re-filter: a campaign that has since been hidden,
  // deleted or unpublished still has donations in the window, so it survives the
  // aggregation and must be dropped by the visibility filters rather than
  // ranked. This is why the map lookup is allowed to miss.
  const rows = await campaignsByIds(candidates.map(([id]) => id));

  const campaigns = candidates
    .filter(([id]) => rows.has(id))
    .slice(0, limit)
    // Rank is assigned only after filtering and trimming, or a dropped campaign
    // leaves a gap and the list reads 1, 2, 4.
    .map(([id, cents], i) => ({
      ...toLeaderboardCampaign(rows.get(id)!, i + 1),
      periodRaisedCents: cents,
    }));

  return attachCampaignCurrencies(campaigns);
}

export async function getTopCampaigns(limit = 20): Promise<LeaderboardCampaign[]> {
  const cols = await campaignColumns();
  // Bounded: an empty leaderboard is an acceptable degraded state, an unbounded
  // stall on the whole page is not (DB-backed pages measured ~7s against an
  // unreachable Supabase). The existing `error || !data` path already renders
  // empty, so a timeout simply takes the same branch.
  const { data, error } = await boundedQuery(
    applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, category, trust_status, nonprofit_verified, location, profiles:user_id(full_name, avatar_url)'),
      cols,
    )
      .order('raised_amount', { ascending: false })
      .limit(limit),
  );

  if (error || !data) return [];

  const campaigns = data.map((c, i) => {
    const profile = asProfile(c.profiles);
    return {
      rank: i + 1,
      id: c.id,
      slug: c.slug,
      title: c.title,
      tagline: c.tagline,
      coverImageUrl: c.cover_image_url,
      goalAmount: c.goal_amount,
      raisedAmount: c.raised_amount,
      backerCount: c.backer_count,
      category: c.category,
      trustStatus: c.trust_status,
      nonprofitVerified: c.nonprofit_verified,
      location: c.location,
      organizerName: profile.full_name || 'CharitMe Organizer',
      organizerAvatarUrl: profile.avatar_url ?? null,
    };
  });

  return attachCampaignCurrencies(campaigns);
}

export async function getTopDonors(period: LeaderboardPeriod, limit = 20): Promise<LeaderboardDonor[]> {
  const cutoff = periodCutoff(period);

  let query = supabaseAdmin
    .from('donations')
    .select('donor_id, amount_cents, created_at')
    .eq('status', 'completed')
    .eq('anonymous', false)
    .not('donor_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(DONOR_SCAN_LIMIT);

  if (cutoff) query = query.gte('created_at', cutoff);

  const { data, error } = await boundedQuery(query);
  if (error || !data) return [];

  const totals = new Map<string, { totalCents: number; donationCount: number }>();
  for (const row of data) {
    if (!row.donor_id) continue;
    const entry = totals.get(row.donor_id) ?? { totalCents: 0, donationCount: 0 };
    entry.totalCents += row.amount_cents;
    entry.donationCount += 1;
    totals.set(row.donor_id, entry);
  }

  const ranked = [...totals.entries()]
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const donorIds = ranked.map(([id]) => id);
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, avatar_url, show_public_profile')
    .in('id', donorIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return ranked.map(([donorId, stats], i) => {
    const profile = profileMap.get(donorId);
    // A donor who set Profile Visibility to Private must not be named here.
    // Settings describes that control as governing "who can see your giving
    // activity on the leaderboard and donor walls", and /donors/[id] already
    // 404s for them — but this returned their real full_name and avatar
    // regardless, and the UI used the flag only to drop the hyperlink. Their
    // name still rendered, and still shipped inside the server-rendered HTML.
    // Anonymize at the source so it never reaches the client; the donation
    // still counts toward the ranking, exactly like an anonymous gift.
    const isPublic = profile?.show_public_profile ?? true;
    return {
      rank: i + 1,
      donorId,
      name: isPublic ? (profile?.full_name || 'Generous Donor') : 'Generous Donor',
      avatarUrl: isPublic ? (profile?.avatar_url ?? null) : null,
      totalCents: stats.totalCents,
      donationCount: stats.donationCount,
      showPublicProfile: isPublic,
    };
  });
}
