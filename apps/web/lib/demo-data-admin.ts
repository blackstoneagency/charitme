import 'server-only';
import { isApprovedDemoSeedSlug } from './demo-data-core';
import { supabaseAdmin } from './supabase';

export type DemoCampaignReview = {
  id: string;
  title: string;
  slug: string;
  status: string;
  is_demo: boolean;
  accept_donations: boolean;
  deleted_at: string | null;
  created_at: string;
};

export type DemoDataSnapshot = {
  counts: { campaigns: number; donations: number; profiles: number };
  campaigns: DemoCampaignReview[];
  truncated: boolean;
};

const REVIEW_LIMIT = 2000;

export async function getDemoDataSnapshot(): Promise<DemoDataSnapshot> {
  const [campaignCount, donationCount, profileCount, campaignRows] = await Promise.all([
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    supabaseAdmin.from('donations').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    supabaseAdmin
      .from('campaigns')
      .select('id,title,slug,status,is_demo,accept_donations,deleted_at,created_at')
      .or('is_demo.eq.true,slug.like.seed-campaign-%,slug.like.campaign-%')
      .order('created_at', { ascending: false })
      .limit(REVIEW_LIMIT),
  ]);

  const error = campaignCount.error ?? donationCount.error ?? profileCount.error ?? campaignRows.error;
  if (error) throw new Error('Demo data could not be loaded.');

  const campaigns = ((campaignRows.data ?? []) as DemoCampaignReview[])
    .filter((row) => row.is_demo || isApprovedDemoSeedSlug(row.slug));

  return {
    counts: {
      campaigns: campaignCount.count ?? 0,
      donations: donationCount.count ?? 0,
      profiles: profileCount.count ?? 0,
    },
    campaigns,
    truncated: (campaignRows.data?.length ?? 0) === REVIEW_LIMIT,
  };
}
