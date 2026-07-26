import 'server-only';
import { supabaseAdmin } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Nonprofit organization portal data.
//
// `nonprofit_profiles` is read by the admin console, the Stripe webhook and
// lib/tax-server.ts — but was read by no user-facing page, so the organization
// that owns the record could not see it.
//
// The consequential part is tax receipts. tax-server.ts issues donors a
// deductible receipt only when the org counts as verified AND has receipts
// enabled. A nonprofit had no way to learn whether its donors were getting
// official receipts, or what was blocking them. `donorsGetTaxReceipts` below
// mirrors that rule exactly — see the note on it before changing either side.
// ─────────────────────────────────────────────────────────────────────────────

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type NonprofitProfile = {
  id: string;
  name: string;
  slug: string;
  mission: string | null;
  taxId: string | null;
  websiteUrl: string | null;
  country: string;
  address: string | null;
  verificationStatus: VerificationStatus;
  /** True when the org counts as verified (legacy bool OR status column). */
  isVerified: boolean;
  taxReceiptEnabled: boolean;
  publicProfileEnabled: boolean;
  /** The single fact that matters to donors — see donorsGetTaxReceipts. */
  donorsGetTaxReceipts: boolean;
};

export type NonprofitCampaign = {
  id: string; slug: string; title: string; status: string;
  goalCents: number; raisedCents: number; backerCount: number;
  coverImageUrl: string | null; category: string | null;
};

export type NonprofitSummary = {
  profile: NonprofitProfile | null;
  campaigns: NonprofitCampaign[];
  totalRaisedCents: number;
  activeCount: number;
};

type ProfileRow = {
  id: string; name: string; slug: string; mission: string | null; tax_id: string | null;
  website_url: string | null; country: string | null; address: string | null;
  verified: boolean | null; verification_status: string | null;
  tax_receipt_enabled: boolean | null; public_profile_enabled: boolean | null;
};
type CampaignRow = {
  id: string; slug: string; title: string; status: string | null;
  goal_amount: number | null; raised_amount: number | null; backer_count: number | null;
  cover_image_url: string | null; category: string | null;
};

const VALID_STATUSES: VerificationStatus[] = ['unverified', 'pending', 'verified', 'rejected'];

/**
 * Whether the organization is treated as verified.
 *
 * Mirrors lib/tax-server.ts: `Boolean(np.verified) || np.verification_status === 'verified'`.
 * Both columns exist because `verified` predates `verification_status`; either
 * one being set counts. Showing a *different* answer here than the receipt
 * pipeline uses would tell a nonprofit its donors are covered when they are not.
 */
export function isNonprofitVerified(verified: boolean | null, status: string | null): boolean {
  return Boolean(verified) || status === 'verified';
}

export function normalizeVerificationStatus(raw: string | null, verified: boolean | null): VerificationStatus {
  if (raw && (VALID_STATUSES as string[]).includes(raw)) return raw as VerificationStatus;
  // Legacy rows may carry only the boolean.
  return verified ? 'verified' : 'unverified';
}

/** Pure shaping, split out so the receipt logic and totals are unit-testable. */
export function buildNonprofitSummary(
  profileRow: ProfileRow | null,
  campaignRows: CampaignRow[],
): NonprofitSummary {
  const campaigns: NonprofitCampaign[] = campaignRows.map((c) => ({
    id: c.id, slug: c.slug, title: c.title, status: c.status ?? 'draft',
    goalCents: c.goal_amount ?? 0, raisedCents: c.raised_amount ?? 0,
    backerCount: c.backer_count ?? 0, coverImageUrl: c.cover_image_url, category: c.category,
  }));

  let profile: NonprofitProfile | null = null;
  if (profileRow) {
    const isVerified = isNonprofitVerified(profileRow.verified, profileRow.verification_status);
    const taxReceiptEnabled = Boolean(profileRow.tax_receipt_enabled);
    profile = {
      id: profileRow.id,
      name: profileRow.name,
      slug: profileRow.slug,
      mission: profileRow.mission,
      taxId: profileRow.tax_id,
      websiteUrl: profileRow.website_url,
      country: profileRow.country ?? 'US',
      address: profileRow.address,
      verificationStatus: normalizeVerificationStatus(profileRow.verification_status, profileRow.verified),
      isVerified,
      taxReceiptEnabled,
      publicProfileEnabled: profileRow.public_profile_enabled !== false,
      // BOTH are required — this is the rule tax-server applies per donation.
      donorsGetTaxReceipts: isVerified && taxReceiptEnabled,
    };
  }

  return {
    profile,
    campaigns,
    totalRaisedCents: campaigns.reduce((sum, c) => sum + c.raisedCents, 0),
    activeCount: campaigns.filter((c) => c.status === 'active').length,
  };
}

/** The signed-in user's nonprofit organization and its campaigns. */
export async function getNonprofitSummary(ownerId: string): Promise<NonprofitSummary> {
  const [{ data: profileData }, { data: campaignData }] = await Promise.all([
    supabaseAdmin
      .from('nonprofit_profiles')
      .select('id,name,slug,mission,tax_id,website_url,country,address,verified,verification_status,tax_receipt_enabled,public_profile_enabled')
      .eq('owner_id', ownerId)
      .maybeSingle(),
    supabaseAdmin
      .from('campaigns')
      .select('id,slug,title,status,goal_amount,raised_amount,backer_count,cover_image_url,category')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return buildNonprofitSummary(
    (profileData ?? null) as ProfileRow | null,
    (campaignData ?? []) as CampaignRow[],
  );
}
