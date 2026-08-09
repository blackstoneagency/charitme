import { describe, expect, it } from 'vitest';
import { CAMPAIGN_STEPS, CAMPAIGN_STEP_META } from '../lib/campaign-flow-core';
import { WIZARD_STEPS, OPTIONAL_STEP_KEYS, isOptionalStep, minutesRemaining, normalizeStep } from '../lib/wizard-steps';

describe('wizard step adapter', () => {
  it('derives its order, labels, numbering, and timing from the core model', () => {
    expect(WIZARD_STEPS.map((step) => step.key)).toEqual(CAMPAIGN_STEPS);
    expect(WIZARD_STEPS.map((step) => step.num)).toEqual(CAMPAIGN_STEPS.map((_, index) => index + 1));
    for (const step of WIZARD_STEPS) {
      expect(step.label).toBe(CAMPAIGN_STEP_META[step.key].label);
      expect(step.minutes).toBe(CAMPAIGN_STEP_META[step.key].minutes);
      expect(isOptionalStep(step.key)).toBe(!CAMPAIGN_STEP_META[step.key].required);
    }
  });

  it('does not mark a launch-readiness step optional', () => {
    expect([...OPTIONAL_STEP_KEYS]).toEqual([]);
  });

  it('normalizes legacy drafts and rejects unusable keys', () => {
    expect(normalizeStep('category')).toBe('category');
    expect(normalizeStep('path')).toBe('beneficiary');
    expect(normalizeStep('essentials')).toBe('purpose');
    expect(normalizeStep('')).toBeNull();
  });

  it('counts down to preview and stops after publication', () => {
    expect(minutesRemaining('purpose')).toBeGreaterThan(minutesRemaining('goal'));
    expect(minutesRemaining('publish')).toBe(0);
    expect(minutesRemaining('share')).toBe(0);
  });
});
