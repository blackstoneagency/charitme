import { describe, it, expect } from 'vitest';
import {
  followUpPlan,
  nextFollowUp,
  remainingFollowUps,
  type FollowUpForm,
} from '../lib/campaign-followups';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

const base: FollowUpForm = {
  forSelf: '',
  beneficiaryName: '',
  beneficiaryRelationship: '',
  category: '',
  goal: '',
  deadline: '',
};

describe('campaign follow-ups', () => {
  it('asks who it is for first when unknown', () => {
    expect(nextFollowUp(base)?.id).toBe('for-self');
  });

  it('skips beneficiary name + relationship when the campaign is for yourself', () => {
    const ids = followUpPlan({ ...base, forSelf: 'true' }).map((q) => q.id);
    expect(ids).not.toContain('beneficiary-name');
    expect(ids).not.toContain('relationship');
    // still asks category / goal / deadline
    expect(ids).toContain('category');
    expect(ids).toContain('goal');
  });

  it('asks beneficiary name + relationship when for someone else', () => {
    const ids = followUpPlan({ ...base, forSelf: 'false' }).map((q) => q.id);
    expect(ids).toContain('beneficiary-name');
    expect(ids).toContain('relationship');
    // order: name before relationship
    expect(ids.indexOf('beneficiary-name')).toBeLessThan(ids.indexOf('relationship'));
  });

  it('never re-asks a field the AI or profile already filled', () => {
    const filled: FollowUpForm = {
      forSelf: 'true',
      beneficiaryName: '',
      beneficiaryRelationship: '',
      category: 'Medical',
      goal: '5000',
      deadline: '2026-09-01',
    };
    expect(followUpPlan(filled)).toEqual([]);
    expect(nextFollowUp(filled)).toBeNull();
    expect(remainingFollowUps(filled)).toBe(0);
  });

  it('treats a zero / blank goal as unset but a positive goal as set', () => {
    expect(followUpPlan({ ...base, forSelf: 'true', category: 'Medical', goal: '0' }).some((q) => q.id === 'goal')).toBe(true);
    expect(followUpPlan({ ...base, forSelf: 'true', category: 'Medical', goal: '2500' }).some((q) => q.id === 'goal')).toBe(false);
  });

  it('deadline is skippable; who-it-is-for and category/goal are required', () => {
    // who-it-is-for is required — check it on an empty form (where it appears).
    expect(followUpPlan(base).find((q) => q.id === 'for-self')?.skippable).toBe(false);
    const plan = followUpPlan({ ...base, forSelf: 'false' });
    expect(plan.find((q) => q.id === 'deadline')?.skippable).toBe(true);
    expect(plan.find((q) => q.id === 'category')?.skippable).toBe(false);
    expect(plan.find((q) => q.id === 'goal')?.skippable).toBe(false);
  });

  it('resolves the whole flow as answers arrive, one at a time', () => {
    let form = { ...base };
    const order: string[] = [];
    for (let i = 0; i < 12; i++) {
      const q = nextFollowUp(form);
      if (!q) break;
      order.push(q.id);
      // answer it with a plausible value
      const answer =
        q.id === 'for-self' ? 'false' :
        q.id === 'goal' ? '1000' :
        q.id === 'deadline' ? '2026-10-01' :
        'Something';
      form = { ...form, [q.field]: answer };
    }
    expect(order).toEqual(['for-self', 'beneficiary-name', 'relationship', 'category', 'goal', 'deadline']);
    expect(nextFollowUp(form)).toBeNull();
  });
});

describe('category follow-up options stay in sync with the canonical list', () => {
  const categoryQuestion = followUpPlan(base).find((q) => q.id === 'category');

  it('offers every real campaign category', () => {
    // Regression: this list was hardcoded and had drifted to 11 of the 18
    // categories, so a sports team, cheer squad, event, family need, travel,
    // volunteering or wish campaign could only be filed under "Other".
    const offered = new Set((categoryQuestion?.options ?? []).map((o) => o.value));
    const missing = CAMPAIGN_CATEGORIES.filter((c) => !offered.has(c));
    expect(missing, `categories missing from the follow-up picker: ${missing.join(', ')}`).toEqual([]);
  });

  it('still offers an Other escape hatch', () => {
    expect((categoryQuestion?.options ?? []).map((o) => o.value)).toContain('Other');
  });
});
