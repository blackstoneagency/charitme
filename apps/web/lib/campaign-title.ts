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

// Several phrases above already carry their own determiner ("the team", "our
// cause", "a creative project"). Those read as broken English after "Support my
// …" — "Support my the team" — which hit 11 of the 18 categories, including
// Sports, Competition and Creative. This is the possessive-safe form used only
// for the "Support my …" template; the determiner forms above still serve
// "Help <name> with …" and "Help support …".
const CATEGORY_PHRASE_POSSESSIVE: Record<string, string> = {
  Nonprofit: 'cause',
  Environment: 'environmental cause',
  Community: 'community',
  Competition: 'team',
  Creative: 'creative project',
  Event: 'event',
  Faith: 'faith community',
  Family: 'family',
  Sports: 'team',
  Travel: 'journey',
  Wishes: 'wish',
};

/** Fallback when no category is chosen — "Support my this cause" is not English. */
const DEFAULT_POSSESSIVE_PHRASE = 'cause';

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
  const category = (input.category ?? '').trim();
  const phrase = CATEGORY_PHRASE[category] ?? 'this cause';
  const name = (input.beneficiaryName ?? '').trim();
  const isSelf = (input.forSelf ?? '') === 'true';

  if (name) return clampTitle(`Help ${name} with ${phrase}`);
  if (isSelf) {
    const mine = CATEGORY_PHRASE_POSSESSIVE[category]
      ?? (category in CATEGORY_PHRASE ? phrase : DEFAULT_POSSESSIVE_PHRASE);
    return clampTitle(`Support my ${mine}`);
  }
  return clampTitle(`Help support ${phrase}`);
}
