import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ONBOARDING_STEPS,
  STEP_META,
  COMPLETABLE_STEPS,
  isOnboardingStep,
  onboardingProgress,
  completedCount,
  isOnboardingComplete,
  initialStep,
  stepPosition,
  nextStep,
  previousStep,
  type OnboardingState,
} from '../lib/onboarding-core';

const state = (over: Partial<OnboardingState> = {}): OnboardingState => ({
  hasName: false, savedCount: 0, ...over,
});

describe('every step maps to storage that already exists', () => {
  it('profiles carries the columns the profile and updates steps write', () => {
    // The flow was designed around what the database can store TODAY. A step
    // writing to a column behind an unapplied migration would be a form that
    // lies — it would appear to save and silently discard the answer.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    const match = /CREATE TABLE public\.profiles \(([\s\S]*?)\n\);/.exec(schema);
    expect(match, 'profiles moved').toBeTruthy();
    for (const column of ['full_name', 'notification_updates', 'notification_marketing', 'campaign_recommendations']) {
      expect(match![1], `${column} must exist for the tour to save it`).toContain(column);
    }
  });

  it('saved_campaigns exists for the causes step', () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    expect(schema).toContain('CREATE TABLE public.saved_campaigns');
  });

  it('there is NO onboarding flag column, which is why progress is derived', () => {
    // If one is ever added, this fails and `onboardingProgress` should be
    // revisited deliberately rather than left deriving around a real column.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    const match = /CREATE TABLE public\.profiles \(([\s\S]*?)\n\);/.exec(schema);
    expect(match![1]).not.toContain('onboard');
  });
});

describe('step vocabulary', () => {
  it('accepts only real steps', () => {
    expect(isOnboardingStep('profile')).toBe(true);
    expect(isOnboardingStep('interests')).toBe(false);
    expect(isOnboardingStep(null)).toBe(false);
  });

  it('names and describes every step, so no panel renders blank', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(STEP_META[step].title.length).toBeGreaterThan(0);
      expect(STEP_META[step].blurb.length).toBeGreaterThan(0);
    }
  });
});

describe('onboardingProgress', () => {
  it('marks exactly one step current — the first unfinished one', () => {
    const progress = onboardingProgress(state({ hasName: true }));
    expect(progress.profile).toBe('done');
    expect(progress.causes).toBe('current');
    expect(Object.values(progress).filter((s) => s === 'current')).toHaveLength(1);
  });

  it('never marks `start` done, because giving does not finish', () => {
    const progress = onboardingProgress(state({ hasName: true, savedCount: 3 }));
    expect(progress.start).toBe('todo');
  });

  it('never marks `updates` done, because consent cannot be inferred from a default', () => {
    // notification_updates defaults true and notification_marketing defaults
    // false, so the database cannot tell an explicit choice from an untouched
    // default. Marking it done would claim a decision nobody made.
    const progress = onboardingProgress(state({ hasName: true, savedCount: 1 }));
    expect(progress.updates).toBe('current');
  });

  it('reflects work done elsewhere rather than nagging', () => {
    // Someone who set their name in settings should not be told to set it here.
    // A stored flag would have kept asking.
    expect(onboardingProgress(state({ hasName: true })).profile).toBe('done');
    expect(onboardingProgress(state({ savedCount: 1 })).causes).toBe('done');
  });

  it('starts everyone at the first step when nothing is done', () => {
    const progress = onboardingProgress(state());
    expect(progress.profile).toBe('current');
    expect(progress.causes).toBe('todo');
  });
});

describe('completion', () => {
  it('does not require a donation', () => {
    // Gating setup on giving would turn a setup flow into a sales funnel.
    expect(isOnboardingComplete(state({ hasName: true, savedCount: 1 }))).toBe(true);
    expect(COMPLETABLE_STEPS).not.toContain('start');
  });

  it('does not count the notification step, which cannot be attested', () => {
    expect(COMPLETABLE_STEPS).not.toContain('updates');
  });

  it('counts only finished steps', () => {
    expect(completedCount(state())).toBe(0);
    expect(completedCount(state({ hasName: true }))).toBe(1);
    expect(completedCount(state({ hasName: true, savedCount: 2 }))).toBe(2);
  });

  it('is incomplete while anything completable remains', () => {
    expect(isOnboardingComplete(state({ hasName: true }))).toBe(false);
  });
});

describe('initialStep', () => {
  it('resumes where the person stopped, not at step one', () => {
    expect(initialStep(state({ hasName: true }))).toBe('causes');
    expect(initialStep(state({ hasName: true, savedCount: 1 }))).toBe('updates');
  });

  it('resumes at updates once the attestable steps are done', () => {
    expect(initialStep(state({ hasName: true, savedCount: 1 }))).toBe('updates');
  });

  it('lands on the first step for a brand-new account', () => {
    expect(initialStep(state())).toBe('profile');
  });
});

describe('navigation between steps', () => {
  it('stepPosition is 1-based, because it is announced as "Step N of M"', () => {
    expect(stepPosition('profile')).toEqual({ index: 1, total: 4 });
    expect(stepPosition('start')).toEqual({ index: 4, total: 4 });
  });

  it('has no next after the last, and no previous before the first', () => {
    expect(nextStep('start')).toBeNull();
    expect(previousStep('profile')).toBeNull();
  });

  it('walks forward and back symmetrically', () => {
    for (let i = 0; i < ONBOARDING_STEPS.length - 1; i += 1) {
      const here = ONBOARDING_STEPS[i]!;
      const after = nextStep(here);
      expect(after).toBe(ONBOARDING_STEPS[i + 1]);
      expect(previousStep(after!)).toBe(here);
    }
  });
});
