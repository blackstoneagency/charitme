export const PLATFORM_FEE_PERCENT = 0;
export const DEFAULT_DONOR_TIP_PERCENT = 8;
export const PROCESSING_FEE_PERCENT = 2.9;
export const PROCESSING_FEE_FIXED_CENTS = 30;
export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 1_000_000_00;

export const CAMPAIGN_CATEGORIES = [
  'Medical',
  'Memorial',
  'Emergency',
  'Nonprofit',
  'Education',
  'Animal',
  'Environment',
  'Business',
  'Community',
  'Competition',
  'Creative',
  'Event',
  'Faith',
  'Family',
  'Sports',
  'Travel',
  'Volunteer',
  'Wishes',
] as const;

export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];

export const TIP_OPTIONS = [0, 5, 8, 10, 12] as const;

export function platformFee(_amountCents: number): number {
  return 0;
}

export function processingFee(amountCents: number): number {
  return Math.round(amountCents * (PROCESSING_FEE_PERCENT / 100)) + PROCESSING_FEE_FIXED_CENTS;
}

export function donorTip(amountCents: number, tipPercent = DEFAULT_DONOR_TIP_PERCENT): number {
  return Math.max(0, Math.round(amountCents * (tipPercent / 100)));
}

export function donationTotal(amountCents: number, coverProcessingFee: boolean, tipPercent = DEFAULT_DONOR_TIP_PERCENT): number {
  return amountCents + donorTip(amountCents, tipPercent) + (coverProcessingFee ? processingFee(amountCents) : 0);
}

export function netToFundraiser(amountCents: number): number {
  return amountCents - platformFee(amountCents);
}
