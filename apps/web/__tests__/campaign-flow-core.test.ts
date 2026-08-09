import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_STEPS,
  CAMPAIGN_STEP_META,
  builderSteps,
  canGoBack,
  firstIncompleteStep,
  minutesRemaining,
  nextIncompleteStepAfter,
  nextStep,
  normalizeStep,
  optionalSteps,
  previousStep,
  stepPosition,
  type CampaignStep,
} from '../lib/campaign-flow-core';

const PREVIEW_STEPS = [
  'purpose', 'beneficiary', 'category', 'location', 'goal', 'plan',
  'story', 'media', 'settings', 'payout', 'verify', 'review',
] as const;

describe('unified campaign journey', () => {
  it('has twelve builder screens followed by publish and share', () => {
    expect(builderSteps()).toEqual(PREVIEW_STEPS);
    expect(CAMPAIGN_STEPS).toEqual([...PREVIEW_STEPS, 'publish', 'share']);
    expect(new Set(CAMPAIGN_STEPS).size).toBe(CAMPAIGN_STEPS.length);
  });

  it('provides metadata for every step', () => {
    for (const step of CAMPAIGN_STEPS) {
      expect(CAMPAIGN_STEP_META[step].id).toBe(step);
      expect(CAMPAIGN_STEP_META[step].title).not.toBe('');
    }
  });

  it('reports the preview as step 12 of 12', () => {
    expect(stepPosition('purpose')).toEqual({ index: 1, total: 12 });
    expect(stepPosition('review')).toEqual({ index: 12, total: 12 });
  });
});

describe('navigation', () => {
  it('walks forward and backward without branching by builder path', () => {
    const walked: CampaignStep[] = ['purpose'];
    let current: CampaignStep | null = 'purpose';
    while (current && nextStep(current)) {
      current = nextStep(current);
      if (current) walked.push(current);
    }
    expect(walked).toEqual(CAMPAIGN_STEPS);
    for (let index = 1; index < CAMPAIGN_STEPS.length; index += 1) {
      expect(previousStep(CAMPAIGN_STEPS[index]!)).toBe(CAMPAIGN_STEPS[index - 1]);
    }
  });

  it('cannot navigate backward after publication', () => {
    expect(canGoBack('purpose')).toBe(false);
    expect(canGoBack('review')).toBe(true);
    expect(canGoBack('publish')).toBe(false);
    expect(canGoBack('share')).toBe(false);
  });

  it('counts only pre-publish work', () => {
    expect(minutesRemaining('purpose')).toBeGreaterThan(minutesRemaining('story'));
    expect(minutesRemaining('review')).toBe(0);
    expect(minutesRemaining('publish')).toBe(0);
  });
});

describe('requirements and migration', () => {
  it('requires every launch-readiness screen', () => {
    expect(optionalSteps()).toEqual([]);
  });

  it('maps every retired key to a rendered screen', () => {
    expect(normalizeStep('path')).toBe('beneficiary');
    expect(normalizeStep('type')).toBe('beneficiary');
    expect(normalizeStep('basics')).toBe('beneficiary');
    expect(normalizeStep('essentials')).toBe('purpose');
    expect(normalizeStep('title')).toBe('purpose');
    expect(normalizeStep('rewards')).toBe('settings');
    expect(normalizeStep('summary')).toBe('review');
    expect(normalizeStep('live')).toBe('publish');
    expect(normalizeStep('unknown')).toBeNull();
  });

  it('resumes at the first unfinished required screen', () => {
    expect(firstIncompleteStep({})).toBe('purpose');
    expect(firstIncompleteStep({ purpose: true })).toBe('beneficiary');
    const completed = Object.fromEntries(builderSteps().map((step) => [step, true])) as Partial<Record<CampaignStep, boolean>>;
    expect(firstIncompleteStep(completed)).toBe('review');
  });

  it('lets the AI path ask only the next missing question', () => {
    const generated = Object.fromEntries(builderSteps().map((step) => [step, true])) as Partial<Record<CampaignStep, boolean>>;
    generated.location = false;
    generated.media = false;
    expect(nextIncompleteStepAfter('beneficiary', generated)).toBe('location');
    expect(nextIncompleteStepAfter('location', generated)).toBe('media');
    generated.media = true;
    expect(nextIncompleteStepAfter('location', generated)).toBe('review');
  });
});
