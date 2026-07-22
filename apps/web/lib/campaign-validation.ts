export type CampaignPublicationInput = {
  title: string;
  description: string;
  goalAmount: number;
};

export function validateCampaignPublication(input: CampaignPublicationInput): string | null {
  if (input.title.trim().length < 3) return 'Active campaigns need a title of at least 3 characters.';
  if (input.description.trim().length < 20) return 'Active campaigns need a story of at least 20 characters.';
  if (!Number.isInteger(input.goalAmount) || input.goalAmount < 100) return 'Active campaigns need a goal of at least 100 cents.';
  return null;
}
