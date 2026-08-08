import { describe, it, expect } from 'vitest';
import {
  AI_STEPS, AI_STEP_IDS, EMPTY_DRAFT, CREATE_AT_STEP,
  nextStep, prevStep, stepIndex, stepByNumber, canAdvance,
  suggestImpactLines, impactAllocatedCents, impactRemainingCents, impactOverAllocatedCents,
  restateCause, AI_MIN_STORY_CHARS, AI_MIN_GOAL_CENTS,
  type AiDraft, type AiStepId,
} from '../lib/ai-campaign-steps';

const full = (over: Partial<AiDraft> = {}): AiDraft => ({
  ...EMPTY_DRAFT,
  category: 'Community',
  cause: 'a clean water project bringing safe drinking water to rural communities',
  understood: 'You want to raise money for a clean water project.',
  confirmed: true,
  beneficiary: 'families in the Turkana region',
  location: 'Kenya',
  timeframe: '3 months',
  story: 'x'.repeat(AI_MIN_STORY_CHARS),
  title: 'Clean Water for All',
  goalCents: 2_500_000,
  ...over,
});

describe('the flow is the twelve steps in the design', () => {
  it('has exactly twelve, numbered 1..12 in order', () => {
    expect(AI_STEPS).toHaveLength(12);
    expect(AI_STEPS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(AI_STEPS.map((s) => s.id)).toEqual([...AI_STEP_IDS]);
  });

  it('walks forward through every step and stops at the end', () => {
    let id: AiStepId | null = 'cause';
    const seen: AiStepId[] = [];
    while (id) { seen.push(id); id = nextStep(id); }
    expect(seen).toEqual([...AI_STEP_IDS]);
  });

  it('creates the campaign at step 8, not before', () => {
    expect(stepByNumber(8)!.id).toBe(CREATE_AT_STEP);
    // Everything up to and including creation must not need a campaign to exist.
    for (const s of AI_STEPS.filter((x) => x.number <= 8)) {
      expect(s.requiresCampaign, `step ${s.number} must not require a campaign`).toBe(false);
    }
    // …and everything after it does.
    for (const s of AI_STEPS.filter((x) => x.number > 8)) {
      expect(s.requiresCampaign, `step ${s.number} acts on the created campaign`).toBe(true);
    }
  });

  it('cannot walk back into drafting once the campaign exists', () => {
    // Going back to "edit the story" after the row is written would offer edits
    // that silently do not apply to the created campaign.
    for (const s of AI_STEPS.filter((x) => x.requiresCampaign)) {
      expect(prevStep(s.id), `step ${s.number} must not go back`).toBeNull();
    }
    expect(prevStep('cause'), 'the first step has nowhere to go back to').toBeNull();
    expect(prevStep('review')).toBe('impact');
  });

  it('only step 9 is optional', () => {
    expect(AI_STEPS.filter((s) => s.optional).map((s) => s.number)).toEqual([9]);
  });
});

describe('each step gates on its own field', () => {
  it('step 1 needs a category AND a described cause', () => {
    expect(canAdvance('cause', EMPTY_DRAFT).ok).toBe(false);
    expect(canAdvance('cause', { ...EMPTY_DRAFT, category: 'Medical' }).ok).toBe(false);
    expect(canAdvance('cause', { ...EMPTY_DRAFT, category: 'Medical', cause: 'too short' }).ok).toBe(false);
    expect(canAdvance('cause', full()).ok).toBe(true);
  });

  it('step 2 needs an explicit confirmation', () => {
    expect(canAdvance('understand', full({ confirmed: false })).ok).toBe(false);
    expect(canAdvance('understand', full()).ok).toBe(true);
  });

  it('step 4 enforces the same story length publishing does', () => {
    expect(canAdvance('story', full({ story: 'x'.repeat(AI_MIN_STORY_CHARS - 1) })).ok).toBe(false);
    expect(canAdvance('story', full()).ok).toBe(true);
  });

  it('step 6 enforces the goal floor and ceiling', () => {
    expect(canAdvance('goal', full({ goalCents: AI_MIN_GOAL_CENTS - 1 })).ok).toBe(false);
    expect(canAdvance('goal', full({ goalCents: 999_999_999_9 })).ok).toBe(false);
    expect(canAdvance('goal', full()).ok).toBe(true);
  });

  it('step 7 never blocks — an impact plan is optional on purpose', () => {
    // Requiring one pushes people to invent line items to get past a wizard,
    // which is the fabricated-outcome problem this flow exists to avoid.
    expect(canAdvance('impact', full({ impact: [] })).ok).toBe(true);
  });

  it('every failed gate explains itself', () => {
    for (const step of ['cause', 'understand', 'questions', 'story', 'title', 'goal'] as AiStepId[]) {
      const gate = canAdvance(step, EMPTY_DRAFT);
      expect(gate.ok).toBe(false);
      expect(gate.reason, `${step} must say why it is blocked`).toBeTruthy();
    }
  });
});

describe('step 8 re-checks everything before writing a row', () => {
  it('passes only when the whole draft is valid', () => {
    expect(canAdvance('review', full()).ok).toBe(true);
  });

  it('catches a field emptied AFTER its own step passed', () => {
    // The real failure: pass step 4, go back, clear the story, jump forward.
    // A wizard that only re-checks the current step creates a campaign with no
    // story. Each of these must be caught at the last gate.
    for (const bad of [
      { story: '' }, { title: '' }, { goalCents: 0 },
      { confirmed: false }, { beneficiary: '' }, { category: '' },
    ]) {
      const gate = canAdvance('review', full(bad));
      expect(gate.ok, `review must reject ${JSON.stringify(bad)}`).toBe(false);
      expect(gate.reason).toBeTruthy();
    }
  });
});

describe('the impact plan arithmetic is honest about over-allocation', () => {
  it('suggested lines always sum to exactly the goal', () => {
    // Rounding drift shows up as "$0.02 still to allocate", which reads as a
    // platform bug. Odd numbers are the case that exposes it.
    for (const goal of [2_500_000, 999_999, 100_001, 7, 1_000_000]) {
      const lines = suggestImpactLines(goal, 'Community');
      expect(impactAllocatedCents(lines), `goal ${goal}`).toBe(goal);
    }
  });

  it('suggests nothing for no goal, rather than empty rows', () => {
    expect(suggestImpactLines(0, 'Medical')).toEqual([]);
    expect(suggestImpactLines(-5, 'Medical')).toEqual([]);
  });

  it('falls back to neutral labels for an unknown category', () => {
    expect(suggestImpactLines(300, 'Not A Category')).toHaveLength(3);
  });

  it('reports the remainder, never a negative one', () => {
    const lines = [{ label: 'a', quantity: 1, cents: 400_000 }];
    expect(impactRemainingCents(1_000_000, lines)).toBe(600_000);
    // Over-allocated: "-$4,000 left" reads as a platform arithmetic bug.
    expect(impactRemainingCents(100_000, [{ label: 'a', quantity: 1, cents: 500_000 }])).toBe(0);
  });

  it('says over-allocation plainly instead of hiding it', () => {
    expect(impactOverAllocatedCents(100_000, [{ label: 'a', quantity: 1, cents: 500_000 }])).toBe(400_000);
    expect(impactOverAllocatedCents(1_000_000, [{ label: 'a', quantity: 1, cents: 400_000 }])).toBe(0);
  });

  it('ignores junk cents rather than propagating NaN into the total', () => {
    const junk = [{ label: 'a', quantity: 1, cents: NaN }, { label: 'b', quantity: 1, cents: -50 }];
    expect(impactAllocatedCents(junk)).toBe(0);
  });
});

describe('the step-2 restatement can actually be checked by reading it', () => {
  it('reuses what the organizer typed', () => {
    const said = restateCause({ category: 'Community', cause: 'A clean water project in Kenya.' });
    expect(said).toBe('You want to raise money for a clean water project in Kenya.');
  });

  it('adds no detail the organizer never gave', () => {
    // The point of step 2 is that the organizer can verify it. A restatement
    // that invents specifics is unverifiable by definition.
    const cause = 'a school roof';
    const said = restateCause({ category: 'Education', cause });
    const invented = said.toLowerCase()
      .replace('you want to raise money for ', '')
      .replace(cause, '')
      .replace(/[.\s]/g, '');
    expect(invented).toBe('');
  });

  it('says nothing at all when nothing was typed', () => {
    expect(restateCause({ category: 'Medical', cause: '   ' })).toBe('');
  });
});

describe('step lookup', () => {
  it('indexes and finds by number', () => {
    expect(stepIndex('cause')).toBe(0);
    expect(stepIndex('ready')).toBe(11);
    expect(stepByNumber(1)!.id).toBe('cause');
    expect(stepByNumber(12)!.id).toBe('ready');
    expect(stepByNumber(13)).toBeUndefined();
  });
});
