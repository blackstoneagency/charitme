export type TrustStatus = 'Verified' | 'Strong Trust' | 'Needs More Info' | 'Under Review';

export type TrustSignal = {
  label: string;
  state: 'verified' | 'watch' | 'pending';
  detail: string;
};

export type CampaignTrustInput = {
  cover_image_url?: string | null;
  tagline?: string | null;
  description?: string | null;
  deadline?: string | null;
  raised_amount?: number | null;
  goal_amount?: number | null;
  backer_count?: number | null;
  status?: string | null;
  identity_verified?: boolean | null;
  beneficiary_verified?: boolean | null;
  stripe_onboarded?: boolean | null;
  evidence_count?: number | null;
  account_age_days?: number | null;
  prior_campaign_count?: number | null;
  admin_review_status?: string | null;
  risk_flag_count?: number | null;
  /** True when the risk-flag lookup failed, so `risk_flag_count` proves nothing. */
  risk_signal_unavailable?: boolean;
};

export const BRAND = {
  name: 'CharitMe',
  positioning: 'Free fundraising powered by AI.',
  promise: 'Fundraising with built-in trust.',
  mission: 'Create the world’s most trusted, fastest, AI-powered fundraising platform.',
} as const;

export const AI_MOAT_FEATURES = [
  {
    title: 'AI Trust Engine',
    complaint: 'Donors are afraid campaigns are fake.',
    solution: 'Identity, beneficiary, story, image, payout, social proof, and risk checks become clear donor-facing trust signals.',
  },
  {
    title: 'AI Campaign Copilot',
    complaint: 'Organizers struggle to write a compelling fundraiser.',
    solution: 'A conversational wizard turns rough notes into authentic titles, stories, FAQs, donation tiers, and share copy.',
  },
  {
    title: 'AI Growth Engine',
    complaint: 'Most campaigns never get enough visibility.',
    solution: 'Health scoring, donor audience suggestions, share timing, updates, and thank-you generators keep momentum alive.',
  },
  {
    title: 'Transparency Ledger',
    complaint: 'Donors do not know where money went.',
    solution: 'Milestones, receipts, expenses, payout status, and impact summaries create public accountability.',
  },
] as const;

export const TRUST_PILLARS = [
  'Verified identity and beneficiary',
  'Verified Stripe Connect payout destination',
  'AI fraud and duplicate-story screening',
  'Receipt-backed milestone tracking',
  'Clear fee, tip, and payout transparency',
  'Donor impact updates after the gift',
] as const;

export const GROWTH_PLAYBOOK = [
  'Rewrite the story for clarity, urgency, and authenticity',
  'Recommend a realistic goal using category and urgency signals',
  'Generate social posts, email drafts, SMS copy, and donor asks',
  'Prompt updates before donor momentum fades',
  'Create personalized donor share kits after checkout',
  'Suggest donation tiers and donor FAQs',
] as const;

export const AI_COPILOT_ACTIONS = [
  'Generate campaign title',
  'Write authentic campaign story',
  'Rewrite in hopeful, urgent, concise, or nonprofit tones',
  'Suggest funding goal',
  'Create social captions',
  'Create email appeal',
  'Create SMS share message',
  'Generate donor FAQ',
  'Recommend donation tiers',
  'Score campaign quality',
  'Suggest missing trust signals',
] as const;

export function calculateTrustScore(campaign: CampaignTrustInput): number {
  let score = 34;

  if (campaign.identity_verified) score += 12;
  if (campaign.beneficiary_verified) score += 10;
  if (campaign.stripe_onboarded) score += 10;
  if (campaign.cover_image_url) score += 6;
  if ((campaign.tagline ?? '').length >= 24) score += 4;
  if ((campaign.description ?? '').length >= 280) score += 8;
  if ((campaign.evidence_count ?? 0) > 0) score += 8;
  if (campaign.deadline) score += 4;
  if ((campaign.backer_count ?? 0) >= 3) score += 5;
  if ((campaign.account_age_days ?? 0) >= 14) score += 4;
  if ((campaign.prior_campaign_count ?? 0) > 0) score += 3;
  if (campaign.admin_review_status === 'approved') score += 10;
  if (campaign.status === 'active') score += 4;

  // "We could not check" must not score the same as "we checked and it is clean".
  // When the risk lookup fails we apply the full risk deduction rather than the
  // clean-bill benefit: briefly under-scoring an honest campaign during a database
  // blip is a far smaller harm than briefly certifying a flagged one as
  // trustworthy, and it self-corrects on the next successful read.
  const RISK_MAX_DEDUCTION = 24;
  score -= campaign.risk_signal_unavailable
    ? RISK_MAX_DEDUCTION
    : Math.min(RISK_MAX_DEDUCTION, (campaign.risk_flag_count ?? 0) * 8);

  return Math.max(0, Math.min(99, score));
}

/**
 * Signals a trust score is meaningless without.
 *
 * `calculateTrustScore` treats an ABSENT field exactly like a FALSE one — an
 * input that omits `identity_verified` scores the same as one where identity
 * verification failed. That is the same "could not check ≠ checked and clean"
 * confusion `risk_signal_unavailable` already exists to prevent, applied to the
 * positive signals instead of the risk deduction.
 *
 * Measured on production before this was added: `CampaignCard` passes 5 of the
 * 15 signals the scorer reads, so the other 10 scored as failures and EVERY
 * campaign came out 52 or 57 — always "Needs More Info", including the 18 of 18
 * cards on /supporter-space that carried an admin-set "✓ Verified" badge at the
 * same time. A chip contradicting the badge beside it, on every card.
 */
const SCORE_CRITICAL_SIGNALS = [
  'identity_verified', 'stripe_onboarded', 'evidence_count', 'admin_review_status',
] as const;

/**
 * Whether this input carries enough to produce a trust score worth showing.
 *
 * False when NONE of the verification signals is present — that input cannot
 * distinguish an unverified campaign from one whose verification simply was not
 * loaded, and a score derived from it is a confident-looking constant.
 *
 * Callers that render a score to a visitor must consult this first. Callers that
 * feed the scorer a full row (the trust-score APIs) always pass.
 */
export function trustScoreIsMeasurable(campaign: CampaignTrustInput): boolean {
  return SCORE_CRITICAL_SIGNALS.some((k) => campaign[k] !== undefined);
}

export function getTrustStatus(score: number, underReview = false): TrustStatus {
  if (underReview) return 'Under Review';
  if (score >= 88) return 'Verified';
  if (score >= 70) return 'Strong Trust';
  return 'Needs More Info';
}

export function getTrustLabel(score: number): string {
  return getTrustStatus(score);
}

export function getTrustSignals(campaign: CampaignTrustInput): TrustSignal[] {
  return [
    {
      label: 'Identity',
      state: campaign.identity_verified ? 'verified' : 'pending',
      detail: campaign.identity_verified ? 'Organizer identity is verified.' : 'Identity verification will improve donor confidence.',
    },
    {
      label: 'Beneficiary',
      state: campaign.beneficiary_verified ? 'verified' : 'pending',
      detail: campaign.beneficiary_verified ? 'Beneficiary details are verified.' : 'Beneficiary verification is recommended before fast payouts.',
    },
    {
      label: 'Payout destination',
      state: campaign.stripe_onboarded ? 'verified' : 'pending',
      detail: campaign.stripe_onboarded ? 'Stripe Connect payout account is connected.' : 'Connect Stripe before requesting payouts.',
    },
    {
      label: 'Story quality',
      state: (campaign.description ?? '').length >= 280 ? 'verified' : 'watch',
      detail: (campaign.description ?? '').length >= 280 ? 'Campaign has enough context for donor review.' : 'AI Copilot should expand the story.',
    },
    {
      label: 'Evidence',
      state: (campaign.evidence_count ?? 0) > 0 || campaign.cover_image_url ? 'verified' : 'pending',
      detail: (campaign.evidence_count ?? 0) > 0 ? 'Supporting evidence is attached.' : 'Add images, receipts, or documents.',
    },
  ];
}

export function scoreCampaignQuality(input: { title: string; story: string; goalCents: number; hasMedia: boolean }): number {
  let score = 20;
  if (input.title.length >= 12) score += 15;
  if (input.story.length >= 400) score += 25;
  if (input.goalCents >= 500_00) score += 10;
  if (input.hasMedia) score += 15;
  if (input.story.includes('because') || input.story.includes('so that')) score += 10;
  return Math.min(100, score);
}
