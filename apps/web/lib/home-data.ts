import 'server-only';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { supabaseAdmin } from './supabase';
import type { RotatorCampaign } from '../app/HeroRotator';
import type { HomeCampaign, StoryFilters, StoryFilterValue } from './home-types';
import { formatHomeCents, normalizeStoryFilters, shortHomeCount } from './home-utils';

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
  const categoryValues = categoryGroup(normalized.storyCategory as StoryFilterValue);
  let query = supabaseAdmin
    .from('campaigns')
    .select('id,slug,title,tagline,description,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,created_at,status')
    .eq('status', 'active')
    .eq('visibility', 'public')
    .is('deleted_at', null);

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

export async function getHomeData(filters: StoryFilters): Promise<{
  stats: string[][];
  heroCampaign: HomeCampaign | null;
  featuredCampaigns: HomeCampaign[];
  carouselCampaigns: HomeCampaign[];
  rotatorCampaigns: RotatorCampaign[];
  heroPercent: number;
  daysLeft: number;
}> {
  const [
    { data: campaigns },
    carouselCampaigns,
    { data: rotatorRaw },
    { count: campaignCount },
    completedDonationResult,
    { data: trustRows },
  ] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('id,slug,title,description,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,profiles:user_id(full_name)')
      .eq('status', 'active')
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .order('raised_amount', { ascending: false })
      .limit(3),
    getStoryCampaigns(filters),
    supabaseAdmin
      .from('campaigns')
      .select('id,slug,title,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,video_url,featured,profiles:user_id(full_name)')
      .eq('status', 'active')
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .not('cover_image_url', 'is', null)
      .neq('cover_image_url', '')
      .order('featured', { ascending: false })
      .order('raised_amount', { ascending: false })
      .limit(20),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active').eq('visibility', 'public').is('deleted_at', null),
    supabaseAdmin.from('donations').select('amount_cents', { count: 'exact' }).eq('status', 'completed'),
    supabaseAdmin
      .from('campaigns')
      .select('campaign_health_score')
      .eq('status', 'active')
      .eq('visibility', 'public')
      .is('deleted_at', null)
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
    stats: [
      [formatHomeCents(platformRaised), 'Raised on CharitMe'],
      [(campaignCount ?? 0).toLocaleString(), 'Active Campaigns'],
      [shortHomeCount(donationCount), 'Donations Recorded'],
      [`${trustAverage}%`, 'Trust Score Average'],
    ],
  };
}
