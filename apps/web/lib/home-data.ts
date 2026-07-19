import 'server-only';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { supabaseAdmin } from './supabase';
import type { RotatorCampaign } from '../app/HeroRotator';
import type { HomeCampaign, StoryFilters, StoryFilterValue } from './home-types';
import { formatHomeCents, normalizeStoryFilters, shortHomeCount } from './home-utils';
import { campaignColumns, applyLiveFilters } from './campaign-visibility';

const INDIVIDUAL_CATEGORIES: string[] = CAMPAIGN_CATEGORIES.filter(category =>
  !['Nonprofit', 'Community', 'Environment', 'Volunteer', 'Event'].includes(category),
);
const NONPROFIT_CATEGORIES = ['Nonprofit', 'Environment', 'Volunteer'];
const COMMUNITY_CATEGORIES = ['Community', 'Event'];
const EMERGENCY_CATEGORIES = ['Emergency', 'Medical'];

function categoryGroup(value: StoryFilterValue): string[] {
  if (value === 'individuals') return INDIVIDUAL_CATEGORIES;
  if (value === 'nonprofits') return NONPROFIT_CATEGORIES;
  if (value === 'community') return COMMUNITY_CATEGORIES;
  if (value === 'emergency') return EMERGENCY_CATEGORIES;
  return [];
}

export function profileName(value: HomeCampaign['profiles']): string {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile?.full_name ?? 'CharitMe Organizer';
}

// Schema-resilient "live public campaign" filtering (shared — see the module
// for why the visibility/deleted_at columns are probed rather than assumed).

/** Batch-fetch each campaign's configured currency from campaign_launch_settings. */
export async function attachCampaignCurrencies<T extends { id: string }>(items: T[]): Promise<(T & { currency: string | null })[]> {
  if (items.length === 0) return [];
  const { data: launchSettings } = await supabaseAdmin
    .from('campaign_launch_settings')
    .select('campaign_id, currency')
    .in('campaign_id', items.map((c) => c.id));

  const currencyMap = new Map<string, string>();
  for (const ls of launchSettings ?? []) {
    if (ls.currency) currencyMap.set(ls.campaign_id, ls.currency);
  }

  return items.map((item) => ({ ...item, currency: currencyMap.get(item.id) ?? null }));
}

export async function getStoryCampaigns(filters: StoryFilters): Promise<HomeCampaign[]> {
  const normalized = normalizeStoryFilters(filters);
  const cols = await campaignColumns();
  const categoryValues = categoryGroup(normalized.storyCategory as StoryFilterValue);
  let query = applyLiveFilters(
    supabaseAdmin
      .from('campaigns')
      .select('id,slug,title,tagline,description,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,created_at,status'),
    cols,
  );

  if (categoryValues.length > 0) {
    query = query.in('category', categoryValues);
  }

  if (normalized.storyQ) {
    // PostgREST .or() parses commas/parens as filter syntax — strip them so
    // searches like "Smith, John" don't break the filter (or inject extra clauses)
    const safeQ = normalized.storyQ.replace(/[,()]/g, ' ').trim();
    if (safeQ) {
      query = query.or(`title.ilike.%${safeQ}%,tagline.ilike.%${safeQ}%,description.ilike.%${safeQ}%,category.ilike.%${safeQ}%`);
    }
  }

  if (normalized.storySort === 'raised') {
    query = query.order('raised_amount', { ascending: false });
  } else if (normalized.storySort === 'donors') {
    query = query.order('backer_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(12);
  if (error) return [];
  return attachCampaignCurrencies((data ?? []) as (HomeCampaign & { id: string })[]);
}

export type HomeMetrics = {
  raisedCents: number;
  campaigns: number;
  donations: number;
  trustAvg: number;
};

export type CategoryStat = { category: string; count: number; supporters: number };

export type RecentDonation = {
  id: string;
  name: string;
  amountCents: number;
  campaignTitle: string;
  campaignSlug: string;
  createdAt: string;
};

/** Pure aggregation of campaign rows into per-category counts, most-first. */
export function aggregateCategoryStats(rows: { category: string | null; backer_count: number | null }[]): CategoryStat[] {
  const map = new Map<string, { count: number; supporters: number }>();
  for (const row of rows) {
    const cat = row.category ?? 'Community';
    const entry = map.get(cat) ?? { count: 0, supporters: 0 };
    entry.count += 1;
    entry.supporters += row.backer_count ?? 0;
    map.set(cat, entry);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, count: v.count, supporters: v.supporters }))
    .sort((a, b) => b.count - a.count);
}

/** Real campaign counts + supporter totals per category, for the "Discover causes" grid. */
export async function getCategoryStats(): Promise<CategoryStat[]> {
  const cols = await campaignColumns();
  const { data } = await applyLiveFilters(
    supabaseAdmin.from('campaigns').select('category, backer_count'),
    cols,
  );
  return aggregateCategoryStats((data ?? []) as { category: string | null; backer_count: number | null }[]);
}

/** Recent completed donations for the live social-proof feed. Anonymous donors are redacted. */
export async function getRecentDonations(limit = 8): Promise<RecentDonation[]> {
  const cols = await campaignColumns();
  const campaignJoin = cols.visibility
    ? 'campaigns:campaign_id(title, slug, visibility)'
    : 'campaigns:campaign_id(title, slug)';
  const { data } = await supabaseAdmin
    .from('donations')
    .select(`id, amount_cents, anonymous, created_at, offline_donor_name, ${campaignJoin}, profiles:donor_id(full_name)`)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit * 3);

  return mapRecentDonations((data ?? []) as unknown as RawDonationRow[], limit);
}

type JoinedCampaign = { title: string; slug: string; visibility?: string | null };
export type RawDonationRow = {
  id: string;
  amount_cents: number;
  anonymous: boolean;
  created_at: string;
  offline_donor_name: string | null;
  campaigns: JoinedCampaign | JoinedCampaign[] | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

/**
 * Pure transform for the recent-donations feed:
 * - redacts anonymous donors to "Anonymous",
 * - never surfaces donations to private campaigns or missing/joined campaigns,
 * - falls back to offline name then a friendly default,
 * - caps the result at `limit`.
 */
export function mapRecentDonations(rows: RawDonationRow[], limit: number): RecentDonation[] {
  const out: RecentDonation[] = [];
  for (const r of rows) {
    const camp = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns;
    if (!camp || camp.visibility === 'private') continue; // never surface private campaigns
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const name = r.anonymous ? 'Anonymous' : (prof?.full_name || r.offline_donor_name || 'A kind supporter');
    out.push({
      id: r.id,
      name,
      amountCents: r.amount_cents,
      campaignTitle: camp.title,
      campaignSlug: camp.slug,
      createdAt: r.created_at,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getHomeData(filters: StoryFilters): Promise<{
  stats: string[][];
  metrics: HomeMetrics;
  heroCampaign: HomeCampaign | null;
  featuredCampaigns: HomeCampaign[];
  carouselCampaigns: HomeCampaign[];
  rotatorCampaigns: RotatorCampaign[];
  heroPercent: number;
  daysLeft: number;
}> {
  const cols = await campaignColumns();
  const [
    { data: campaigns },
    carouselCampaigns,
    { data: rotatorRaw },
    { count: campaignCount },
    completedDonationResult,
    { data: trustRows },
  ] = await Promise.all([
    applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select('id,slug,title,description,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,profiles:user_id(full_name)'),
      cols,
    )
      .order('raised_amount', { ascending: false })
      .limit(3),
    getStoryCampaigns(filters),
    applyLiveFilters(
      supabaseAdmin
        .from('campaigns')
        .select('id,slug,title,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,video_url,featured,profiles:user_id(full_name)'),
      cols,
    )
      .not('cover_image_url', 'is', null)
      .neq('cover_image_url', '')
      .order('featured', { ascending: false })
      .order('raised_amount', { ascending: false })
      .limit(20),
    applyLiveFilters(supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }), cols),
    supabaseAdmin.from('donations').select('amount_cents', { count: 'exact' }).eq('status', 'completed'),
    applyLiveFilters(
      supabaseAdmin.from('campaigns').select('campaign_health_score'),
      cols,
    )
      .not('campaign_health_score', 'is', null)
      .gt('campaign_health_score', 0),
  ]);

  const featuredCampaigns = await attachCampaignCurrencies((campaigns ?? []) as (HomeCampaign & { id: string })[]);

  type RawRotator = {
    id: string;
    slug: string;
    title: string;
    category: string | null;
    cover_image_url: string | null;
    video_url: string | null;
    featured: boolean | null;
    goal_amount: number;
    raised_amount: number;
    backer_count: number;
    trust_status: string | null;
    campaign_health_score: number | null;
    deadline: string | null;
    profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
  };

  const rawRotatorCampaigns = ((rotatorRaw ?? []) as RawRotator[])
    .filter(c => c.cover_image_url && c.cover_image_url.startsWith('http'))
    .map(c => ({
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

  const rotatorCampaigns: RotatorCampaign[] = await attachCampaignCurrencies(rawRotatorCampaigns);

  const platformRaised = ((completedDonationResult.data ?? []) as { amount_cents: number }[])
    .reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
  const donationCount = completedDonationResult.count ?? 0;
  const trustArr = ((trustRows ?? []) as { campaign_health_score: number }[])
    .map(r => r.campaign_health_score ?? 0)
    .filter(s => s > 0);
  const trustAverage = trustArr.length > 0
    ? Math.round(trustArr.reduce((a, b) => a + b, 0) / trustArr.length)
    : 0;

  const heroCampaign = featuredCampaigns[0] ?? null;
  const raisedTotal = heroCampaign?.raised_amount ?? 0;
  const goalTotal = heroCampaign?.goal_amount ?? 1;
  const daysLeft = heroCampaign?.deadline
    ? Math.max(0, Math.ceil((new Date(heroCampaign.deadline).getTime() - Date.now()) / 86_400_000))
    : 0;

  return {
    heroCampaign,
    featuredCampaigns,
    carouselCampaigns,
    rotatorCampaigns,
    heroPercent: Math.min(100, Math.round((raisedTotal / goalTotal) * 100)),
    daysLeft,
    metrics: {
      raisedCents: platformRaised,
      campaigns: campaignCount ?? 0,
      donations: donationCount,
      trustAvg: trustAverage,
    },
    stats: [
      [formatHomeCents(platformRaised), 'Raised on CharitMe'],
      [(campaignCount ?? 0).toLocaleString(), 'Active Campaigns'],
      [shortHomeCount(donationCount), 'Donations Recorded'],
      [`${trustAverage}%`, 'Trust Score Average'],
    ],
  };
}
