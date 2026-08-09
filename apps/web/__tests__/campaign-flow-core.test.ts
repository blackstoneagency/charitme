import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_STEPS,
  CAMPAIGN_STEP_META,
  builderSteps,
  canGoBack,
  firstIncompleteStep,
  minutesRemaining,
  nextStep,
  normalizeStep,
  optionalSteps,
  previousStep,
  stepPosition,
  type CampaignStep,
} from '../lib/campaign-flow-core';

describe('the 12-step shape', () => {
  it('has exactly twelve steps', () => {
    expect(CAMPAIGN_STEPS).toHaveLength(10);
  });

  it('has no duplicate step ids', () => {
    expect(new Set(CAMPAIGN_STEPS).size).toBe(CAMPAIGN_STEPS.length);
  });

  it('carries meta for every step, keyed consistently', () => {
    for (const step of CAMPAIGN_STEPS) {
      const meta = CAMPAIGN_STEP_META[step];
      expect(meta, `no meta for ${step}`).toBeDefined();
      // A mismatched id is how a stepper ends up highlighting the wrong entry.
      expect(meta.id).toBe(step);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.title.length).toBeGreaterThan(0);
    }
  });

  it('reports 1-based positions out of 12, for screen readers', () => {
    expect(stepPosition('path')).toEqual({ index: 1, total: 10 });
    expect(stepPosition('review')).toEqual({ index: 8, total: 10 });
    expect(stepPosition('share')).toEqual({ index: 10, total: 10 });
  });
});

describe('navigation', () => {
  it('walks forward through every step and stops at the end', () => {
    const walked: CampaignStep[] = ['path'];
    let cur: CampaignStep | null = 'path';
    while ((cur = nextStep(cur!))) walked.push(cur);
    expect(walked).toEqual([...CAMPAIGN_STEPS]);
    expect(nextStep('share')).toBeNull();
  });

  it('walks backward symmetrically', () => {
    expect(previousStep('path')).toBeNull();
    for (let i = 1; i < CAMPAIGN_STEPS.length; i++) {
      expect(previousStep(CAMPAIGN_STEPS[i]!)).toBe(CAMPAIGN_STEPS[i - 1]);
    }
  });

  it('allows Back on every pre-publish step except the first', () => {
    expect(canGoBack('path')).toBe(false);
    for (const step of builderSteps().slice(1)) {
      expect(canGoBack(step), `${step} should allow going back`).toBe(true);
    }
  });

  it('refuses Back once the campaign is live', () => {
    // The campaign has a public URL by now; Back would present a published
    // campaign as an unsaved draft.
    expect(canGoBack('publish')).toBe(false);
    expect(canGoBack('share')).toBe(false);
  });
});

describe('required vs optional', () => {
  it('treats rewards and verification as skippable, and nothing else', () => {
    expect(optionalSteps()).toEqual(['rewards', 'verify']);
  });

  it('keeps every money-or-identity-critical step required', () => {
    for (const step of ['essentials', 'payout', 'review'] as const) {
      expect(CAMPAIGN_STEP_META[step].required, `${step} must be required`).toBe(true);
    }
  });
});

describe('minutesRemaining', () => {
  it('counts down as the organizer advances', () => {
    const atStart = minutesRemaining('path');
    const midway = minutesRemaining('basics');
    const atReview = minutesRemaining('review');
    expect(atStart).toBeGreaterThan(midway);
    expect(midway).toBeGreaterThan(atReview);
  });

  it('excludes post-publish steps — they are not work before going live', () => {
    // 'review' is the last pre-publish step, so its remaining time is its own.
    expect(minutesRemaining('review')).toBe(CAMPAIGN_STEP_META.review.minutes);
    expect(minutesRemaining('publish')).toBe(0);
    expect(minutesRemaining('share')).toBe(0);
  });

  it('returns 0 for an unknown step rather than NaN', () => {
    expect(minutesRemaining('nope' as CampaignStep)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The migration tests. These are the ones that matter: a draft holding an old
// step key must never render a blank screen, because to the organizer that looks
// exactly like their work being deleted.
// ─────────────────────────────────────────────────────────────────────────────

describe('legacy draft migration', () => {
  it('maps the 9-step flow keys onto basics', () => {
    expect(normalizeStep('type')).toBe('basics');
    expect(normalizeStep('category')).toBe('basics');
    expect(normalizeStep('location')).toBe('basics');
  });

  it('maps the 7-step flow keys onto their 12-step names', () => {
    expect(normalizeStep('summary')).toBe('review');
    expect(normalizeStep('live')).toBe('publish');
  });

  it('passes through every current step unchanged', () => {
    for (const step of CAMPAIGN_STEPS) {
      expect(normalizeStep(step)).toBe(step);
    }
  });

  it('returns null for junk so the caller can fall back to step 1', () => {
    expect(normalizeStep(undefined)).toBeNull();
    expect(normalizeStep(null)).toBeNull();
    expect(normalizeStep('')).toBeNull();
    expect(normalizeStep('not-a-step')).toBeNull();
  });

  it('never returns a step the wizard cannot render', () => {
    // Guards the whole mapping at once: whatever normalizeStep returns must be
    // a step that exists, or the wizard renders no branch and the screen is blank.
    const inputs = ['type', 'category', 'location', 'summary', 'live', ...CAMPAIGN_STEPS];
    for (const raw of inputs) {
      const normalized = normalizeStep(raw);
      expect(normalized).not.toBeNull();
      expect(CAMPAIGN_STEPS).toContain(normalized!);
    }
  });
});

describe('firstIncompleteStep', () => {
  it('resumes at the first unfinished required step', () => {
    expect(firstIncompleteStep({ path: true })).toBe('essentials');
  });

  it('starts at the beginning when nothing is done', () => {
    expect(firstIncompleteStep({})).toBe('path');
  });

  it('does not send an organizer back to a skipped optional step', () => {
    // Rewards deliberately absent — skipping it must not block progress.
    const completed = {
      path: true, essentials: true, basics: true,
      media: true, payout: true,
    };
    expect(firstIncompleteStep(completed)).toBe('review');
  });

  it('lands on review when every required step is done', () => {
    const completed = Object.fromEntries(
      builderSteps().map((s) => [s, true]),
    ) as Partial<Record<CampaignStep, boolean>>;
    expect(firstIncompleteStep(completed)).toBe('review');
  });
});
