/**
 * Per-step validation for the campaign builder.
 *
 * Extracted from the wizard component so the rules — and crucially *which field*
 * each failure belongs to — can be unit-tested. The builder can't be driven in a
 * test environment (`/create` is auth-gated and there's no database in CI), so
 * without this the field-targeting would ship unverified.
 *
 * The component maps the returned `field` to `aria-invalid`/`aria-describedby`
 * and moves focus to that input, so a keyboard or screen-reader user lands on
 * the thing to fix instead of hunting for it after a panel-level banner.
 */

/** Builder fields that can carry an inline validation error. */
export type BuilderField = 'title' | 'description' | 'goal';

export type BuilderStepError = { field: BuilderField; message: string };

export type BuilderValidationInput = {
  step: string;
  title: string;
  description: string;
  /** Goal in cents, as the component computes it from the raw input. */
  goalCents: number;
  /** Raw goal text — an empty box is allowed through; a too-small number is not. */
  goalRaw: string;
};

/**
 * Returns the field-targeted error for the current step, or null if it passes.
 *
 * Deliberately mirrors the builder's "don't nag about empty optional fields"
 * behaviour: story and goal only complain once the user has actually typed
 * something, so someone deferring them can still move on.
 */
export function validateBuilderStep(input: BuilderValidationInput): BuilderStepError | null {
  const { step, title, description, goalCents, goalRaw } = input;

  if (step === 'title' && title.trim().length < 3) {
    return { field: 'title', message: 'Please enter a campaign title (min 3 characters).' };
  }

  // Caught at the step that owns it rather than at Publish, which used to bounce
  // the organizer back several steps to fix something they thought was done.
  if (step === 'story' && description.trim().length > 0 && description.trim().length < 20) {
    return {
      field: 'description',
      message:
        'Please add a bit more to your story (at least 20 characters) — or leave it empty for now and finish it later.',
    };
  }

  if (step === 'goal' && goalRaw.trim().length > 0 && goalCents < 100) {
    return { field: 'goal', message: 'Please set a fundraising goal of at least $1.' };
  }

  return null;
}
