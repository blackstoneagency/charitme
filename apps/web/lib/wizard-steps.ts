// ─────────────────────────────────────────────────────────────────────────────
// Guided campaign-builder step model — the view adapter.
//
// The model itself now lives in `campaign-flow-core.ts`, which defines the full
// twelve-step journey and owns the navigation rules (what may be skipped, what
// may be gone back to). This module exists so the builder page keeps a single,
// stable shape to render the stepper rail from, and so the legacy re-exports
// below do not have to be chased through every call site at once.
//
// ⚠️ Do NOT re-declare the step list here. It was previously duplicated in this
// file, which is the same hand-maintained-copy drift that bit CAMPAIGN_CATEGORIES
// three times over. There is one list, and it is in campaign-flow-core.ts.
// ─────────────────────────────────────────────────────────────────────────────

import {
  CAMPAIGN_STEPS,
  CAMPAIGN_STEP_META,
  type CampaignStep,
} from './campaign-flow-core';

export {
  canGoBack,
  firstIncompleteStep,
  minutesRemaining,
  nextStep,
  normalizeStep,
  previousStep,
  stepPosition,
} from './campaign-flow-core';

/** Retained name so existing imports keep working; it is a CampaignStep. */
export type WizardStep = CampaignStep;

/**
 * The stepper rail, derived from the model rather than restated.
 *
 * All twelve appear, including the two post-publish steps — the organizer should
 * be able to see that sharing is part of the journey rather than have the flow
 * appear to end at "Review". Reaching those two requires actually publishing;
 * `canGoBack` stops them being used to re-enter the builder afterwards.
 */
export const WIZARD_STEPS: { key: WizardStep; label: string; num: number; minutes: number }[] =
  CAMPAIGN_STEPS.map((key, i) => ({
    key,
    label: CAMPAIGN_STEP_META[key].label,
    num: i + 1,
    minutes: CAMPAIGN_STEP_META[key].minutes,
  }));

/** Steps the organizer may skip without blocking publication. */
export const OPTIONAL_STEP_KEYS: ReadonlySet<WizardStep> = new Set(
  CAMPAIGN_STEPS.filter((s) => !CAMPAIGN_STEP_META[s].required),
);

export function isOptionalStep(step: WizardStep): boolean {
  return OPTIONAL_STEP_KEYS.has(step);
}
