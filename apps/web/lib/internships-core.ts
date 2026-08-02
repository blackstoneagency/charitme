/**
 * Internships — pure classification over `volunteer_opportunities`.
 *
 * ⚠️ **There is deliberately no `internships` table.** An internship IS a
 * volunteer opportunity: `volunteer_opportunities` already carries `category`,
 * `is_remote`, `location`, `time_commitment`, `slots`, `skills` and a `status`
 * CHECK, plus a public listing, a detail page, an apply flow and an admin
 * surface. A separate table would have duplicated every one of those, and drifted
 * from them — the failure this repo has documented repeatedly.
 *
 * So `/internships` is a filtered VIEW of a live table, and anything posted
 * through the existing volunteer admin appears here with no extra step.
 */

/**
 * Category values that mean "internship".
 *
 * Matched case-insensitively against the free-text `category` column, which has
 * no CHECK constraint — so this is a recognition rule, not a validation rule.
 * Kept narrow on purpose: broadening it to `'training'` or `'education'` would
 * sweep in ordinary volunteering and quietly mislabel it as a career placement.
 */
export const INTERNSHIP_CATEGORIES = ['internship', 'internships', 'intern', 'placement', 'fellowship'] as const;

export function isInternshipCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const normalized = category.trim().toLowerCase();
  if (!normalized) return false;
  return (INTERNSHIP_CATEGORIES as readonly string[]).includes(normalized);
}

export type OpportunityLike = {
  category: string | null;
  is_remote?: boolean | null;
  location?: string | null;
  slots?: number | null;
  slots_filled?: number | null;
};

export function isInternship(opportunity: OpportunityLike): boolean {
  return isInternshipCategory(opportunity.category);
}

/**
 * Places left, or `null` when the listing does not publish a cap.
 *
 * `null` rather than 0: an opportunity that never stated a number of places has
 * not run out of them, and "0 places left" would stop someone applying to
 * something that is still open.
 */
export function placesRemaining(opportunity: OpportunityLike): number | null {
  const slots = opportunity.slots;
  if (typeof slots !== 'number' || !Number.isFinite(slots) || slots <= 0) return null;
  const filled = typeof opportunity.slots_filled === 'number' && opportunity.slots_filled > 0
    ? opportunity.slots_filled
    : 0;
  return Math.max(0, slots - filled);
}

/** Human location line: remote, on-site somewhere, or unstated. */
export function describeLocation(opportunity: OpportunityLike): string {
  const location = opportunity.location?.trim();
  if (opportunity.is_remote && location) return `Remote · ${location}`;
  if (opportunity.is_remote) return 'Remote';
  if (location) return location;
  // Not "On-site" — an unstated location is unknown, and guessing on-site would
  // put off a remote applicant for a role that may well be remote.
  return 'Location not stated';
}
