// ─────────────────────────────────────────────────────────────────────────────
// Guided campaign-builder step model.
//
// "Who / what / where" used to be three separate screens that asked almost
// nothing each — three taps of friction before the organizer wrote a word. They
// are now one "Basics" screen, taking the guided path from 9 steps to 7.
//
// Lives in lib/ (not the page) because Next.js restricts what a page module may
// export, and because the legacy-step mapping is exactly the kind of logic that
// breaks silently for users mid-draft unless it is unit-tested.
// ─────────────────────────────────────────────────────────────────────────────

export type WizardStep = 'basics' | 'story' | 'title' | 'goal' | 'media' | 'payout' | 'summary' | 'live';

export const WIZARD_STEPS: { key: WizardStep; label: string; num: number; minutes: number }[] = [
  { key: 'basics',  label: 'Basics',     num: 1, minutes: 1 },
  { key: 'story',   label: 'Your Story', num: 2, minutes: 4 },
  { key: 'title',   label: 'Title',      num: 3, minutes: 1 },
  { key: 'goal',    label: 'Goal',       num: 4, minutes: 1 },
  { key: 'media',   label: 'Media',      num: 5, minutes: 1 },
  { key: 'payout',  label: 'Get Paid',   num: 6, minutes: 1 },
  { key: 'summary', label: 'Review',     num: 7, minutes: 1 },
];

/** Step keys retired when the three opening steps merged into 'basics'. */
const LEGACY_STEP_MAP: Record<string, WizardStep> = {
  type: 'basics',
  category: 'basics',
  location: 'basics',
};

/**
 * Map a stored step value onto a step that still exists.
 *
 * Drafts saved before the merge carry 'type' / 'category' / 'location'. Without
 * this they would resume at the wrong place — or render an empty screen, since
 * no branch matches an unknown key. Returns null when the value is unusable so
 * the caller can fall back to the first step.
 */
export function normalizeStep(raw: string | null | undefined): WizardStep | null {
  if (!raw) return null;
  if (LEGACY_STEP_MAP[raw]) return LEGACY_STEP_MAP[raw];
  if (raw === 'live') return 'live';
  return WIZARD_STEPS.some((s) => s.key === raw) ? (raw as WizardStep) : null;
}

/** Estimated minutes left from this step to the end, for the header counter. */
export function minutesRemaining(step: WizardStep): number {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === step);
  if (idx < 0) return 0;
  return WIZARD_STEPS.slice(idx).reduce((total, s) => total + s.minutes, 0);
}
