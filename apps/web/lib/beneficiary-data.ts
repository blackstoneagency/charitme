import 'server-only';
import { supabaseAdmin } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Beneficiary portal data.
//
// `beneficiary` is a first-class role (lib/roles.ts) with a full invite flow
// (beneficiary_invites → /beneficiary/accept), and campaigns.beneficiary_profile_id
// links a campaign to the person it benefits. Nothing read that column, so an
// accepted beneficiary previously landed on /dashboard/payouts — which scopes every
// query by user_id, the campaign OWNER — and saw an empty dashboard.
//
// These campaigns belong to someone else, so this view is deliberately read-only:
// it answers "how is the fundraiser for me doing, and has money reached me yet?"
// without exposing owner-only controls.
// ─────────────────────────────────────────────────────────────────────────────

export type BeneficiaryCampaign = {
  id: string;
  slug: string;
  title: string;
  status: string;
  goalCents: number;
  raisedCents: number;
  backerCount: number;
  coverImageUrl: string | null;
  category: string | null;
  createdAt: string | null;
  /** The organizer running it — the beneficiary's contact for questions. */
  organizerName: string;
  /** Cents paid out to the organizer for this campaign (payouts with status 'paid'). */
  paidOutCents: number;
  /** Cents requested or approved but not yet paid. */
  pendingPayoutCents: number;
};

export type BeneficiarySummary = {
  campaigns: BeneficiaryCampaign[];
  totalRaisedCents: number;
  totalPaidOutCents: number;
  totalPendingPayoutCents: number;
  activeCount: number;
};

type CampaignRow = {
  id: string; slug: string; title: string; status: string | null;
  goal_amount: number | null; raised_amount: number | null; backer_count: number | null;
  cover_image_url: string | null; category: string | null; created_at: string | null;
  user_id: string | null;
};
type PayoutRow = { campaign_id: string | null; amount_cents: number | null; status: string | null };
type ProfileRow = { id: string; full_name: string | null };

/** Payout statuses that represent money already delivered vs. still in flight. */
const PAID = 'paid';
const IN_FLIGHT = new Set(['requested', 'approved']);

/**
 * Pure assembly of the beneficiary view, split out so it can be unit-tested —
 * the page is auth-gated and there is no database in this environment, so the
 * shaping and money math would otherwise ship unverified.
 */
export function buildBeneficiarySummary(
  campaigns: CampaignRow[],
  payouts: PayoutRow[],
  organizers: ProfileRow[],
): BeneficiarySummary {
  const organizerById = new Map(organizers.map((p) => [p.id, p.full_name ?? 'Organizer']));

  const paidByCampaign = new Map<string, number>();
  const pendingByCampaign = new Map<string, number>();
  for (const p of payouts) {
    if (!p.campaign_id) continue;
    const cents = p.amount_cents ?? 0;
    if (p.status === PAID) {
      paidByCampaign.set(p.campaign_id, (paidByCampaign.get(p.campaign_id) ?? 0) + cents);
    } else if (p.status && IN_FLIGHT.has(p.status)) {
      pendingByCampaign.set(p.campaign_id, (pendingByCampaign.get(p.campaign_id) ?? 0) + cents);
    }
  }

  const rows: BeneficiaryCampaign[] = campaigns.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    status: c.status ?? 'draft',
    goalCents: c.goal_amount ?? 0,
    raisedCents: c.raised_amount ?? 0,
    backerCount: c.backer_count ?? 0,
    coverImageUrl: c.cover_image_url,
    category: c.category,
    createdAt: c.created_at,
    organizerName: (c.user_id && organizerById.get(c.user_id)) || 'Organizer',
    paidOutCents: paidByCampaign.get(c.id) ?? 0,
    pendingPayoutCents: pendingByCampaign.get(c.id) ?? 0,
  }));

  return {
    campaigns: rows,
    totalRaisedCents: rows.reduce((sum, r) => sum + r.raisedCents, 0),
    totalPaidOutCents: rows.reduce((sum, r) => sum + r.paidOutCents, 0),
    totalPendingPayoutCents: rows.reduce((sum, r) => sum + r.pendingPayoutCents, 0),
    activeCount: rows.filter((r) => r.status === 'active').length,
  };
}

/** Campaigns the given profile is the named beneficiary of, with payout state. */
export async function getBeneficiarySummary(profileId: string): Promise<BeneficiarySummary> {
  const { data: campaignData } = await supabaseAdmin
    .from('campaigns')
    .select('id,slug,title,status,goal_amount,raised_amount,backer_count,cover_image_url,category,created_at,user_id')
    .eq('beneficiary_profile_id', profileId)
    .order('created_at', { ascending: false });

  const campaigns = (campaignData ?? []) as CampaignRow[];
  if (campaigns.length === 0) return buildBeneficiarySummary([], [], []);

  const campaignIds = campaigns.map((c) => c.id);
  const organizerIds = [...new Set(campaigns.map((c) => c.user_id).filter(Boolean))] as string[];

  // Batched — one query each, no per-row lookups.
  const [{ data: payoutData }, { data: organizerData }] = await Promise.all([
    supabaseAdmin.from('payouts').select('campaign_id,amount_cents,status').in('campaign_id', campaignIds),
    organizerIds.length
      ? supabaseAdmin.from('profiles').select('id,full_name').in('id', organizerIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);

  return buildBeneficiarySummary(
    campaigns,
    (payoutData ?? []) as PayoutRow[],
    (organizerData ?? []) as ProfileRow[],
  );
}
