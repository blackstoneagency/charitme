// Smart default campaign title so the guided builder never presents an empty
// title field. Deterministic (instant, no network) — this is the same
// AI-fallback pattern used across the app; the organizer can always edit it or
// hit "AI improve". Kept pure for unit tests.

const CATEGORY_PHRASE: Record<string, string> = {
  Medical: 'medical expenses',
  Memorial: 'memorial fund',
  Emergency: 'urgent needs',
  Nonprofit: 'our cause',
  Education: 'education',
  Animal: 'animal care',
  Environment: 'our environment',
  Business: 'small business',
  Community: 'our community',
  Competition: 'the team',
  Creative: 'a creative project',
  Event: 'the event',
  Faith: 'our faith community',
  Family: 'the family',
  Sports: 'the team',
  Travel: 'the journey',
  Volunteer: 'volunteer work',
  Wishes: 'a special wish',
};

export interface TitleInput {
  category?: string | null;
  beneficiaryName?: string | null;
  forSelf?: string | null; // 'true' | 'false'
  description?: string | null;
}

const clampTitle = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 80);

/**
 * Suggest a natural campaign title from what the creator has entered so far.
 * Prefers a named beneficiary, then self vs. someone-else framing, then the
 * category phrase. Never returns empty.
 */
export function suggestCampaignTitle(input: TitleInput): string {
  const phrase = CATEGORY_PHRASE[(input.category ?? '').trim()] ?? 'this cause';
  const name = (input.beneficiaryName ?? '').trim();
  const isSelf = (input.forSelf ?? '') === 'true';

  if (name) return clampTitle(`Help ${name} with ${phrase}`);
  if (isSelf) return clampTitle(`Support my ${phrase}`);
  return clampTitle(`Help support ${phrase}`);
}
