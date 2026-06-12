import { supabaseAdmin } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Reward tiers — based on the number of completed donations a user has
// referred via their personal CharitMe link (?ref=<userId>)
// ─────────────────────────────────────────────────────────────────────────────
export interface ReferralTier {
  name: string;
  icon: string;
  minConversions: number;
  description: string;
}

export const REFERRAL_TIERS: ReferralTier[] = [
  { name: 'Connector',  icon: '🔗', minConversions: 0,  description: 'Share your personal link to get started' },
  { name: 'Advocate',   icon: '📣', minConversions: 3,  description: '3 successful referred donations' },
  { name: 'Influencer', icon: '🌟', minConversions: 10, description: '10 successful referred donations' },
  { name: 'Ambassador', icon: '🤝', minConversions: 25, description: '25 successful referred donations' },
  { name: 'Champion',   icon: '🏆', minConversions: 50, description: '50 successful referred donations' },
];

export interface ReferralTierProgress {
  current: ReferralTier;
  next: ReferralTier | null;
  progress: number;       // 0..1 toward next tier
  remaining: number;      // conversions remaining to reach next tier
}

export function getReferralTier(conversions: number): ReferralTierProgress {
  let current = REFERRAL_TIERS[0];
  for (const tier of REFERRAL_TIERS) {
    if (conversions >= tier.minConversions) current = tier;
  }
  const idx = REFERRAL_TIERS.indexOf(current);
  const next = REFERRAL_TIERS[idx + 1] ?? null;

  if (!next) return { current, next: null, progress: 1, remaining: 0 };

  const span = next.minConversions - current.minConversions;
  const progressInTier = conversions - current.minConversions;
  const progress = span > 0 ? Math.min(1, Math.max(0, progressInTier / span)) : 1;

  return { current, next, progress, remaining: Math.max(0, next.minConversions - conversions) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Referral stats — aggregates share_events created via personal referral
// links (channel='link', utm_source='referral', sharer_id=<userId>)
// ─────────────────────────────────────────────────────────────────────────────
export interface ReferralCampaignStat {
  campaignId: string;
  title: string;
  slug: string;
  attempts: number;
  conversions: number;
  raisedCents: number;
  currency?: string | null;
}

export interface ReferralStats {
  totalAttempts: number;
  totalConversions: number;
  totalRaisedCents: number;
  campaigns: ReferralCampaignStat[];
}

const EMPTY_STATS: ReferralStats = { totalAttempts: 0, totalConversions: 0, totalRaisedCents: 0, campaigns: [] };

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const { data: events } = await supabaseAdmin
    .from('share_events')
    .select('id, campaign_id, converted, donation_id')
    .eq('sharer_id', userId)
    .eq('utm_source', 'referral')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (!events || events.length === 0) return EMPTY_STATS;

  const donationIds = [...new Set(events.filter(e => e.donation_id).map(e => e.donation_id as string))];
  const donationAmounts = new Map<string, number>();
  if (donationIds.length > 0) {
    const { data: donations } = await supabaseAdmin
      .from('donations')
      .select('id, amount_cents')
      .in('id', donationIds);
    for (const d of donations ?? []) donationAmounts.set(d.id, d.amount_cents);
  }

  const campaignIds = [...new Set(events.map(e => e.campaign_id))];
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug')
    .in('id', campaignIds);
  const campaignInfo = new Map((campaigns ?? []).map(c => [c.id, c]));

  const byCampaign = new Map<string, ReferralCampaignStat>();
  let totalConversions = 0;
  let totalRaisedCents = 0;

  for (const ev of events) {
    const info = campaignInfo.get(ev.campaign_id);
    if (!info) continue;

    let stat = byCampaign.get(ev.campaign_id);
    if (!stat) {
      stat = { campaignId: ev.campaign_id, title: info.title, slug: info.slug, attempts: 0, conversions: 0, raisedCents: 0 };
      byCampaign.set(ev.campaign_id, stat);
    }
    stat.attempts += 1;

    if (ev.converted) {
      stat.conversions += 1;
      totalConversions += 1;
      const amount = ev.donation_id ? (donationAmounts.get(ev.donation_id) ?? 0) : 0;
      stat.raisedCents += amount;
      totalRaisedCents += amount;
    }
  }

  const campaignStats = [...byCampaign.values()].sort((a, b) => b.raisedCents - a.raisedCents);

  if (campaignStats.length > 0) {
    const { data: launchSettings } = await supabaseAdmin
      .from('campaign_launch_settings')
      .select('campaign_id, currency')
      .in('campaign_id', campaignStats.map(c => c.campaignId));
    const currencyMap = new Map<string, string>();
    for (const ls of launchSettings ?? []) {
      if (ls.currency) currencyMap.set(ls.campaign_id, ls.currency);
    }
    for (const stat of campaignStats) {
      stat.currency = currencyMap.get(stat.campaignId) ?? null;
    }
  }

  return {
    totalAttempts: events.length,
    totalConversions,
    totalRaisedCents,
    campaigns: campaignStats,
  };
}
