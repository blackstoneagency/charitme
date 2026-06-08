import 'server-only';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { supabaseAdmin } from './supabase';
import type { RotatorCampaign } from '../app/HeroRotator';
import type { HomeCampaign, StoryFilters, StoryFilterValue, StorySortValue } from './home-types';

const INDIVIDUAL_CATEGORIES: string[] = CAMPAIGN_CATEGORIES.filter(category =>
  !['Nonprofit', 'Community', 'Environment', 'Volunteer', 'Event'].includes(category),
);
const NONPROFIT_CATEGORIES = ['Nonprofit', 'Environment', 'Volunteer'];
const COMMUNITY_CATEGORIES = ['Community', 'Event'];
const EMERGENCY_CATEGORIES = ['Emergency', 'Medical'];

function normalizeStoryCategory(value: string | undefined): StoryFilterValue {
  if (value === 'individuals' || value === 'nonprofits' || value === 'community' || value === 'emergency') return value;
  return '';
}

function normalizeStorySort(value: string | undefined): StorySortValue {
  if (value === 'raised' || value === 'donors') return value;
  return 'latest';
}

function cleanStorySearch(value: string | undefined): string {
  return (value ?? '').replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function categoryGroup(value: StoryFilterValue): string[] {
  if (value === 'individuals') return INDIVIDUAL_CATEGORIES;
  if (value === 'nonprofits') return NONPROFIT_CATEGORIES;
  if (value === 'community') return COMMUNITY_CATEGORIES;
  if (value === 'emergency') return EMERGENCY_CATEGORIES;
  return [];
}

export function normalizeStoryFilters(filters: StoryFilters): Required<Pick<StoryFilters, 'storyCategory' | 'storyQ' | 'storySort'>> {
  return {
    storyCategory: normalizeStoryCategory(typeof filters.storyCategory === 'string' ? filters.storyCategory : undefined),
    storyQ: cleanStorySearch(typeof filters.storyQ === 'string' ? filters.storyQ : undefined),
    storySort: normalizeStorySort(typeof filters.storySort === 'string' ? filters.storySort : undefined),
  };
}

export function formatHomeCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  return `$${dollars.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function shortHomeCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function profileName(value: HomeCampaign['profiles']): string {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile?.full_name ?? 'CharitMe Organizer';
}

export async function getStoryCampaigns(filters: StoryFilters): Promise<HomeCampaign[]> {
  const normalized = normalizeStoryFilters(filters);
  const categoryValues = categoryGroup(normalized.storyCategory as StoryFilterValue);
  let query = supabaseAdmin
    .from('campaigns')
    .select('slug,title,tagline,description,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,created_at,status')
    .eq('status', 'active');

  if (categoryValues.length > 0) {
    query = query.in('category', categoryValues);
  }

  if (normalized.storyQ) {
    query = query.or(`title.ilike.%${normalized.storyQ}%,tagline.ilike.%${normalized.storyQ}%,description.ilike.%${normalized.storyQ}%,category.ilike.%${normalized.storyQ}%`);
  }

  if (normalized.storySort === 'raised') {
    query = query.order('raised_amount', { ascending: false });
  } else if (normalized.storySort === 'donors') {
    query = query.order('backer_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(12);
  if (error) throw new Error(error.message);
  return (data ?? []) as HomeCampaign[];
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
      .select('slug,title,description,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,profiles:user_id(full_name)')
      .eq('status', 'active')
      .order('raised_amount', { ascending: false })
      .limit(3),
    getStoryCampaigns(filters),
    supabaseAdmin
      .from('campaigns')
      .select('slug,title,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,video_url,featured,profiles:user_id(full_name)')
      .eq('status', 'active')
      .not('cover_image_url', 'is', null)
      .neq('cover_image_url', '')
      .order('featured', { ascending: false })
      .order('raised_amount', { ascending: false })
      .limit(20),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('donations').select('amount_cents', { count: 'exact' }).eq('status', 'completed'),
    supabaseAdmin
      .from('campaigns')
      .select('campaign_health_score')
      .eq('status', 'active')
      .not('campaign_health_score', 'is', null)
      .gt('campaign_health_score', 0),
  ]);

  const featuredCampaigns = (campaigns ?? []) as HomeCampaign[];

  type RawRotator = {
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

  const rotatorCampaigns: RotatorCampaign[] = ((rotatorRaw ?? []) as RawRotator[])
    .filter(c => c.cover_image_url && c.cover_image_url.startsWith('http'))
    .map(c => ({
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
