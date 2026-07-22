import { describe, it, expect } from 'vitest';
import { publishReadiness, type ReadinessInput } from '../lib/campaign-readiness';

const empty: ReadinessInput = {
  title: '', description: '', goalCents: 0, category: '', country: '',
  coverImageUrl: '', forSelf: 'true', beneficiaryName: '', payoutLinked: false,
};

const complete: ReadinessInput = {
  title: 'Help rebuild the shelter',
  description: 'Our community animal shelter flooded and needs urgent repairs to reopen.',
  goalCents: 500000,
  category: 'Animal',
  country: 'United States',
  coverImageUrl: 'https://img/cover.jpg',
  forSelf: 'true',
  beneficiaryName: '',
  payoutLinked: true,
};

describe('publishReadiness', () => {
  it('an empty draft is not publishable and scores low', () => {
    const r = publishReadiness(empty);
    expect(r.readyToPublish).toBe(false);
    expect(r.score).toBe(0);
    expect(r.missingRequired.map((i) => i.id).sort()).toEqual(['goal', 'story', 'title']);
  });

  it('required items exactly mirror the publish API (title, story, goal)', () => {
    const r = publishReadiness(empty);
    expect(r.items.filter((i) => i.required).map((i) => i.id).sort()).toEqual(['goal', 'story', 'title']);
  });

  it('readyToPublish flips true once title + story + goal are met, even if extras are missing', () => {
    const r = publishReadiness({ ...empty, title: 'A clear title', description: 'A short but valid story here.', goalCents: 100 });
    expect(r.readyToPublish).toBe(true);
    expect(r.missingRequired).toEqual([]);
    expect(r.score).toBeLessThan(100); // category/media/payout still recommended
  });

  it('a fully-filled draft scores 100 and is publishable', () => {
    const r = publishReadiness(complete);
    expect(r.readyToPublish).toBe(true);
    expect(r.score).toBe(100);
  });

  it('adds a beneficiary item only when raising for someone else', () => {
    expect(publishReadiness({ ...empty, forSelf: 'true' }).items.some((i) => i.id === 'beneficiary')).toBe(false);
    const other = publishReadiness({ ...empty, forSelf: 'false' });
    expect(other.items.some((i) => i.id === 'beneficiary')).toBe(true);
    // beneficiary is a recommendation, not a publish blocker
    expect(other.missingRequired.some((i) => i.id === 'beneficiary')).toBe(false);
  });

  it('every item carries the step that fixes it', () => {
    for (const item of publishReadiness(empty).items) {
      expect(typeof item.step).toBe('string');
      if (!item.done) expect(item.hint).toBeTruthy();
    }
  });

  it('the just-under-threshold values do not count as done', () => {
    const r = publishReadiness({ ...empty, title: 'ab', description: 'too short', goalCents: 99 });
    expect(r.items.find((i) => i.id === 'title')?.done).toBe(false); // 2 chars
    expect(r.items.find((i) => i.id === 'story')?.done).toBe(false); // 9 chars < 20
    expect(r.items.find((i) => i.id === 'goal')?.done).toBe(false);  // 99c < $1
  });
});
