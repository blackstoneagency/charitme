/**
 * New-user onboarding — pure step model.
 *
 * The reference shows a four-step welcome tour. Nothing like it existed: a new
 * account landed on the dashboard with no name set, no causes followed and no
 * indication of what to do first.
 *
 * ⚠️ **Every step writes to a column or table that ALREADY EXISTS.** There is no
 * `interests` column on `profiles` and no `onboarding` table, and rather than add
 * one this flow was designed around what the database can actually store today:
 * `profiles.full_name` / `campaign_recommendations` / `notification_*`, and
 * `saved_campaigns`. A step that could not be saved would be a form that lies.
 *
 * Completion is likewise **derived, not flagged** — see `onboardingProgress`. A
 * `completed_at` column would have needed a migration this sandbox cannot apply,
 * which would have made the whole page inert.
 */

export const ONBOARDING_STEPS = ['profile', 'causes', 'updates', 'start'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export type StepMeta = {
  id: OnboardingStep;
  title: string;
  /** What the person gets out of it — not what the platform gets. */
  blurb: string;
};

export const STEP_META: Readonly<Record<OnboardingStep, StepMeta>> = {
  profile: {
    id: 'profile',
    title: 'Tell us about you',
    blurb: 'Your name appears on donations you make, unless you give anonymously.',
  },
  causes: {
    id: 'causes',
    title: 'Follow a cause',
    blurb: 'Save campaigns you care about so you can find them again.',
  },
  updates: {
    id: 'updates',
    title: 'Choose what we send',
    blurb: 'Off by default where it matters. Change any of it later in settings.',
  },
  start: {
    id: 'start',
    title: 'Start your impact',
    blurb: 'Give to something, or raise for something. Both take a couple of minutes.',
  },
};

/** What the database can tell us about how far someone has got. */
export type OnboardingState = {
  hasName: boolean;
  savedCount: number;
};

export type StepStatus = 'done' | 'current' | 'todo';

/**
 * Progress DERIVED from real data rather than from a stored flag.
 *
 * This is why the page works at all without a migration: there is no
 * `onboarding_completed_at` column, and adding one would have made the flow
 * inert in every environment where the migration has not been applied. Deriving
 * it also means the tour tells the truth if someone sets their name elsewhere —
 * a flag would have kept nagging them.
 */
export function onboardingProgress(state: OnboardingState): Record<OnboardingStep, StepStatus> {
  const done: Record<OnboardingStep, boolean> = {
    profile: state.hasName,
    causes: state.savedCount > 0,
    // ⚠️ `updates` is NEVER marked done, and that is a deliberate limit rather
    // than an oversight. `notification_updates` defaults to true and
    // `notification_marketing` to false, so the database cannot distinguish
    // "this person chose these settings" from "nobody ever asked them". Marking
    // it done on arrival would claim a consent decision that was never made.
    // The panel is still a real, saving preferences form — it just is not a
    // completion gate.
    updates: false,
    // `start` is an invitation, never "done" — there is no point at which a
    // person has finished giving or fundraising.
    start: false,
  };

  const firstUndone = ONBOARDING_STEPS.find((step) => !done[step]) ?? 'start';

  return Object.fromEntries(
    ONBOARDING_STEPS.map((step) => [
      step,
      done[step] ? 'done' : step === firstUndone ? 'current' : 'todo',
    ]),
  ) as Record<OnboardingStep, StepStatus>;
}

/**
 * Steps whose completion the database can actually attest to.
 *
 * `updates` and `start` are excluded for different reasons: `start` never
 * finishes, and `updates` cannot be distinguished from its own defaults.
 */
export const COMPLETABLE_STEPS = ONBOARDING_STEPS.filter((s) => s !== 'start' && s !== 'updates');

export function completedCount(state: OnboardingState): number {
  const progress = onboardingProgress(state);
  return COMPLETABLE_STEPS.filter((step) => progress[step] === 'done').length;
}

/**
 * Whether the tour has served its purpose and should stop being offered.
 *
 * Deliberately does NOT require `start`: a person who has set their name and
 * saved a campaign is set up, whether or not they have donated yet. Gating on a
 * donation would turn a setup flow into a sales funnel.
 */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return completedCount(state) === COMPLETABLE_STEPS.length;
}

/**
 * The step to open on arrival: the first unfinished one.
 *
 * Someone returning to a partly-finished tour should land where they stopped,
 * not back at step one re-entering a name they already gave.
 */
export function initialStep(state: OnboardingState): OnboardingStep {
  const progress = onboardingProgress(state);
  return ONBOARDING_STEPS.find((step) => progress[step] === 'current') ?? 'start';
}

/** "Step 2 of 4" — announced to screen readers, so it must be 1-based. */
export function stepPosition(step: OnboardingStep): { index: number; total: number } {
  return { index: ONBOARDING_STEPS.indexOf(step) + 1, total: ONBOARDING_STEPS.length };
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  return i >= 0 && i < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[i + 1]! : null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  return i > 0 ? ONBOARDING_STEPS[i - 1]! : null;
}
