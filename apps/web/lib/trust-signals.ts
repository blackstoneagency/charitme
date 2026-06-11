import 'server-only';
import { supabaseAdmin } from './supabase';
import type { CampaignTrustInput } from './ai-platform';

export type TrustCampaignRow = {
  id: string;
  user_id: string;
  beneficiary_profile_id?: string | null;
  cover_image_url?: string | null;
  tagline?: string | null;
  description?: string | null;
  deadline?: string | null;
  raised_amount?: number | null;
  goal_amount?: number | null;
  backer_count?: number | null;
  status?: string | null;
  trust_status?: string | null;
};

/**
 * Computes the real CampaignTrustInput signals for a campaign by reading
 * profiles, connected_accounts, transparency_ledger_items, campaign_media,
 * and risk_flags from Supabase. This is the source of truth for the
 * publicly displayed CharitScore and the AI Trust Score Coach.
 */
export async function buildCampaignTrustInput(campaign: TrustCampaignRow): Promise<CampaignTrustInput> {
  const beneficiaryId = campaign.beneficiary_profile_id ?? campaign.user_id;
  const sameAsOrganizer = beneficiaryId === campaign.user_id;

  const [organizerRes, beneficiaryRes, connectedRes, evidenceRes, mediaRes, priorRes, riskRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('identity_verified, created_at').eq('id', campaign.user_id).maybeSingle(),
    sameAsOrganizer
      ? Promise.resolve({ data: null })
      : supabaseAdmin.from('profiles').select('identity_verified').eq('id', beneficiaryId).maybeSingle(),
    supabaseAdmin.from('connected_accounts').select('payouts_enabled').eq('user_id', campaign.user_id).maybeSingle(),
    supabaseAdmin.from('transparency_ledger_items').select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id).in('review_status', ['auto_approved', 'approved']),
    supabaseAdmin.from('campaign_media').select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id),
    supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true })
      .eq('user_id', campaign.user_id).neq('id', campaign.id),
    supabaseAdmin.from('risk_flags').select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id).in('status', ['open', 'reviewing']),
  ]);

  const organizer = organizerRes.data as { identity_verified?: boolean | null; created_at?: string | null } | null;
  const beneficiaryProfile = beneficiaryRes.data as { identity_verified?: boolean | null } | null;
  const connected = connectedRes.data as { payouts_enabled?: boolean | null } | null;

  const accountAgeDays = organizer?.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(organizer.created_at).getTime()) / 86_400_000))
    : 0;

  const beneficiaryVerified = sameAsOrganizer
    ? !!organizer?.identity_verified
    : !!beneficiaryProfile?.identity_verified;

  const evidenceCount = (evidenceRes.count ?? 0) + (mediaRes.count ?? 0);

  return {
    cover_image_url: campaign.cover_image_url,
    tagline: campaign.tagline,
    description: campaign.description,
    deadline: campaign.deadline,
    raised_amount: campaign.raised_amount,
    goal_amount: campaign.goal_amount,
    backer_count: campaign.backer_count,
    status: campaign.status,
    identity_verified: !!organizer?.identity_verified,
    beneficiary_verified: beneficiaryVerified,
    stripe_onboarded: !!connected?.payouts_enabled,
    evidence_count: evidenceCount,
    account_age_days: accountAgeDays,
    prior_campaign_count: priorRes.count ?? 0,
    admin_review_status: campaign.trust_status === 'Verified' ? 'approved' : undefined,
    risk_flag_count: riskRes.count ?? 0,
  };
}
