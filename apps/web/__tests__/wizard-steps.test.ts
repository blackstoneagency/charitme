import { describe, it, expect } from 'vitest';
import {
  WIZARD_STEPS,
  OPTIONAL_STEP_KEYS,
  isOptionalStep,
  normalizeStep,
  minutesRemaining,
  type WizardStep,
} from '../lib/wizard-steps';
import { CAMPAIGN_STEPS, CAMPAIGN_STEP_META } from '../lib/campaign-flow-core';

// ─────────────────────────────────────────────────────────────────────────────
// wizard-steps.ts is now a VIEW ADAPTER over campaign-flow-core, not a second
// copy of the step list. These tests cover the adapter — that what the builder
// renders stays faithful to the model — while the model's own rules (navigation,
// migration, optionality) are tested in campaign-flow-core.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

describe('WIZARD_STEPS', () => {
  it('numbers every step once, sequentially, however long the path is', () => {
    // Deliberately derived rather than a hardcoded 12: the path has been 9, 7
    // and 12 steps, and is 10 now that title/story/goal share one screen. The
    // property worth pinning is that the numbering matches the model, not that
    // the model has a particular length.
    expect(WIZARD_STEPS).toHaveLength(CAMPAIGN_STEPS.length);
    expect(WIZARD_STEPS.map((s) => s.num)).toEqual(
      CAMPAIGN_STEPS.map((_, i) => i + 1),
    );
    expect(new Set(WIZARD_STEPS.map((s) => s.key)).size).toBe(CAMPAIGN_STEPS.length);
  });

  it('opens on the path question and ends on Share', () => {
    expect(WIZARD_STEPS[0]!.key).toBe('path');
    expect(WIZARD_STEPS[WIZARD_STEPS.length - 1]!.key).toBe('share');
  });

  it('derives from the model rather than restating it', () => {
    // The whole point of the adapter. If someone reintroduces a hand-written
    // list here, the order or labels will drift from the model and this fails.
    expect(WIZARD_STEPS.map((s) => s.key)).toEqual([...CAMPAIGN_STEPS]);
    for (const step of WIZARD_STEPS) {
      expect(step.label).toBe(CAMPAIGN_STEP_META[step.key].label);
      expect(step.minutes).toBe(CAMPAIGN_STEP_META[step.key].minutes);
    }
  });

  it('numbers each step by its position, so the rail matches "Step N / 12"', () => {
    WIZARD_STEPS.forEach((step, index) => {
      expect(step.num).toBe(index + 1);
    });
  });
});

describe('optional steps', () => {
  it('exposes exactly the two skippable steps', () => {
    expect([...OPTIONAL_STEP_KEYS].sort()).toEqual(['rewards', 'verify']);
  });

  it('agrees with the model about what is optional', () => {
    for (const step of CAMPAIGN_STEPS) {
      expect(isOptionalStep(step)).toBe(!CAMPAIGN_STEP_META[step].required);
    }
  });
});

describe('normalizeStep — in-flight drafts must survive the step changes', () => {
  it('maps every retired 9-step key onto basics', () => {
    for (const legacy of ['type', 'category', 'location']) {
      expect(normalizeStep(legacy)).toBe('basics');
    }
  });

  it('maps the 7-step names onto their replacements', () => {
    // Drafts saved before the 12-step flow carry these; an unmapped key renders
    // no branch, which looks to the organizer like their work was deleted.
    expect(normalizeStep('summary')).toBe('review');
    expect(normalizeStep('live')).toBe('publish');
  });

  it('passes through every current step key unchanged', () => {
    for (const s of WIZARD_STEPS) {
      expect(normalizeStep(s.key)).toBe(s.key);
    }
  });

  it('returns null for unusable input so the caller can fall back', () => {
    expect(normalizeStep(null)).toBeNull();
    expect(normalizeStep(undefined)).toBeNull();
    expect(normalizeStep('')).toBeNull();
    expect(normalizeStep('nonsense')).toBeNull();
  });
});

describe('minutesRemaining', () => {
  it('counts down as the organizer advances', () => {
    const first = minutesRemaining('path');
    const later = minutesRemaining('basics');
    expect(first).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);
  });

  it('totals the pre-publish path from the first step', () => {
    // Publish and share are not work to do before going live, so they are
    // excluded — the counter promises time until the campaign is up.
    const total = WIZARD_STEPS
      .filter((s) => !CAMPAIGN_STEP_META[s.key].postPublish)
      .reduce((t, s) => t + s.minutes, 0);
    expect(minutesRemaining('path')).toBe(total);
  });

  it('is 0 once the campaign is published', () => {
    expect(minutesRemaining('publish')).toBe(0);
    expect(minutesRemaining('share')).toBe(0);
  });

  it('is 0 for a step outside the path', () => {
    expect(minutesRemaining('nope' as WizardStep)).toBe(0);
  });
});
