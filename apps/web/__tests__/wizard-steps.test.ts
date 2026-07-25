import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, normalizeStep, minutesRemaining, type WizardStep } from '../lib/wizard-steps';

describe('WIZARD_STEPS', () => {
  it('is the 7-step guided path with unique, sequential numbering', () => {
    expect(WIZARD_STEPS).toHaveLength(7);
    expect(WIZARD_STEPS.map((s) => s.num)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(WIZARD_STEPS.map((s) => s.key)).size).toBe(7);
  });

  it('opens on Basics and ends on Review', () => {
    expect(WIZARD_STEPS[0].key).toBe('basics');
    expect(WIZARD_STEPS[WIZARD_STEPS.length - 1].key).toBe('summary');
  });
});

describe('normalizeStep — in-flight drafts must survive the step merge', () => {
  it('maps every retired step key onto basics', () => {
    for (const legacy of ['type', 'category', 'location']) {
      expect(normalizeStep(legacy)).toBe('basics');
    }
  });

  it('passes through every current step key unchanged', () => {
    for (const s of WIZARD_STEPS) {
      expect(normalizeStep(s.key)).toBe(s.key);
    }
    expect(normalizeStep('live')).toBe('live');
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
    const first = minutesRemaining('basics');
    const later = minutesRemaining('goal');
    expect(first).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);
  });

  it('totals the whole path from the first step', () => {
    const total = WIZARD_STEPS.reduce((t, s) => t + s.minutes, 0);
    expect(minutesRemaining('basics')).toBe(total);
  });

  it('is 0 for a step outside the path', () => {
    expect(minutesRemaining('live' as WizardStep)).toBe(0);
  });
});
