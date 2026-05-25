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
};

export const AI_MOAT_FEATURES = [
  {
    title: 'AI Trust Engine',
    complaint: 'Donors are afraid campaigns are fake.',
    solution: 'Identity, story, image, duplicate-pattern, payout, and risk checks produce clear donor-facing trust signals.',
  },
  {
    title: 'AI Campaign Copilot',
    complaint: 'Organizers struggle to write a compelling fundraiser.',
    solution: 'A conversational wizard turns rough notes into a polished, authentic campaign in about 30 seconds.',
  },
  {
    title: 'AI Growth Engine',
    complaint: 'Most campaigns never get enough visibility.',
    solution: 'Campaign health scoring, donor audience suggestions, share kits, and update prompts keep momentum alive.',
  },
  {
    title: 'Transparency Ledger',
    complaint: 'Donors do not know where money went.',
    solution: 'Milestones, receipts, payout status, and impact updates become a public accountability layer.',
  },
] as const;

export const TRUST_PILLARS = [
  'Verified identity and payout destination',
  'AI fraud and duplicate-story screening',
  'Receipt-backed milestone tracking',
  'Clear fee and payout transparency',
  'Donor impact updates after the gift',
] as const;

export const GROWTH_PLAYBOOK = [
  'Rewrite the story for clarity, urgency, and authenticity',
  'Recommend the best goal based on similar campaigns',
  'Generate social posts, email drafts, SMS copy, and donor asks',
  'Prompt weekly updates before donor momentum fades',
  'Create personalized donor share kits after checkout',
] as const;

export function calculateTrustScore(campaign: CampaignTrustInput): number {
  let score = 48;

  if (campaign.cover_image_url) score += 8;
  if ((campaign.tagline ?? '').length >= 24) score += 6;
  if ((campaign.description ?? '').length >= 280) score += 10;
  if (campaign.deadline) score += 6;
  if ((campaign.backer_count ?? 0) >= 3) score += 8;
  if ((campaign.raised_amount ?? 0) > 0) score += 6;
  if (campaign.status === 'active') score += 8;

  const goalAmount = campaign.goal_amount ?? 0;
  const raisedAmount = campaign.raised_amount ?? 0;
  if (goalAmount > 0 && raisedAmount / goalAmount >= 0.25) score += 6;

  return Math.max(0, Math.min(98, score));
}

export function getTrustLabel(score: number): string {
  if (score >= 86) return 'High trust';
  if (score >= 70) return 'Strong signals';
  if (score >= 55) return 'Developing trust';
  return 'Needs verification';
}

export function getTrustSignals(campaign: CampaignTrustInput): TrustSignal[] {
  return [
    {
      label: 'Story quality',
      state: (campaign.description ?? '').length >= 280 ? 'verified' : 'watch',
      detail: (campaign.description ?? '').length >= 280
        ? 'Campaign has enough detail for donor review.'
        : 'AI copilot should expand the story before promotion.',
    },
    {
      label: 'Visual proof',
      state: campaign.cover_image_url ? 'verified' : 'pending',
      detail: campaign.cover_image_url
        ? 'Campaign includes a public cover image.'
        : 'Add a real image or receipt to improve confidence.',
    },
    {
      label: 'Momentum',
      state: (campaign.backer_count ?? 0) > 0 ? 'verified' : 'pending',
      detail: (campaign.backer_count ?? 0) > 0
        ? 'Donor activity has started.'
        : 'First donor outreach should be prioritized.',
    },
  ];
}
