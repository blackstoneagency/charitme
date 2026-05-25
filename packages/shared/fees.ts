export const PLATFORM_FEE_PERCENT = 5; // 5% platform fee on all donations

export function platformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

export function netToFundraiser(amountCents: number): number {
  return amountCents - platformFee(amountCents);
}

export const CAMPAIGN_CATEGORIES = [
  'Medical',
  'Education',
  'Emergency',
  'Animals',
  'Community',
  'Environment',
  'Faith',
  'Family',
  'Memorial',
  'Sports',
  'Travel',
  'Volunteer',
  'Other',
] as const;

export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];

export const MIN_DONATION_CENTS = 100; // $1.00
export const MAX_DONATION_CENTS = 1_000_000_00; // $1,000,000
