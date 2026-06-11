import { supabaseAdmin } from './supabase';

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

export async function getTopCampaigns(limit = 20): Promise<LeaderboardCampaign[]> {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, slug, title, tagline, cover_image_url, goal_amount, raised_amount, backer_count, category, trust_status, nonprofit_verified, location, profiles:user_id(full_name, avatar_url)')
    .eq('status', 'active')
    .order('raised_amount', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((c, i) => {
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

  const { data, error } = await query;
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
    return {
      rank: i + 1,
      donorId,
      name: profile?.full_name || 'Generous Donor',
      avatarUrl: profile?.avatar_url ?? null,
      totalCents: stats.totalCents,
      donationCount: stats.donationCount,
      showPublicProfile: profile?.show_public_profile ?? true,
    };
  });
}
