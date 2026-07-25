import { describe, it, expect } from 'vitest';
import { evaluateDonorView, STORY_CONVINCING_CHARS, type DonorPreviewInput } from '../lib/donor-preview';

const base: DonorPreviewInput = {
  title: 'Help Maria rebuild after the fire',
  description: 'x'.repeat(STORY_CONVINCING_CHARS),
  goalCents: 500_000,
  coverImageUrl: 'https://img.test/cover.jpg',
  imageCount: 3,
  forSelf: 'false',
  beneficiaryName: 'Maria Lopez',
  category: 'Emergency',
  country: 'United States',
};

describe('evaluateDonorView', () => {
  it('passes every check for a complete campaign', () => {
    const r = evaluateDonorView(base);
    expect(r.passedCount).toBe(r.total);
    expect(r.confidence).toBe(100);
    expect(r.checks.every((c) => c.passed)).toBe(true);
  });

  it('flags a missing cover photo and points at the media step', () => {
    const r = evaluateDonorView({ ...base, coverImageUrl: '', imageCount: 0 });
    const cover = r.checks.find((c) => c.id === 'cover')!;
    expect(cover.passed).toBe(false);
    expect(cover.step).toBe('media');
    expect(cover.why.length).toBeGreaterThan(10);
  });

  it('accepts a cover supplied only via uploaded images', () => {
    const r = evaluateDonorView({ ...base, coverImageUrl: '', imageCount: 1 });
    expect(r.checks.find((c) => c.id === 'cover')!.passed).toBe(true);
  });

  it('treats a self-campaign as having a clear beneficiary without a name', () => {
    const r = evaluateDonorView({ ...base, forSelf: 'true', beneficiaryName: '' });
    expect(r.checks.find((c) => c.id === 'beneficiary')!.passed).toBe(true);
  });

  it('requires a name when raising for someone else', () => {
    const r = evaluateDonorView({ ...base, forSelf: 'false', beneficiaryName: '   ' });
    expect(r.checks.find((c) => c.id === 'beneficiary')!.passed).toBe(false);
  });

  it('treats a rushed story as unconvincing even though it would publish', () => {
    const r = evaluateDonorView({ ...base, description: 'Please help us out, thank you.' });
    expect(r.checks.find((c) => c.id === 'story')!.passed).toBe(false);
  });

  it('scores an empty campaign at or near zero without throwing', () => {
    const r = evaluateDonorView({
      title: '', description: '', goalCents: 0, coverImageUrl: '', imageCount: 0,
      forSelf: 'false', beneficiaryName: '', category: '', country: '',
    });
    expect(r.confidence).toBe(0);
    expect(r.passedCount).toBe(0);
  });

  it('confidence always tracks passed/total and stays within 0..100', () => {
    for (const imageCount of [0, 1, 2, 5]) {
      const r = evaluateDonorView({ ...base, imageCount });
      expect(r.confidence).toBe(Math.round((r.passedCount / r.total) * 100));
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(100);
    }
  });

  it('every failing check names a real wizard step to fix it', () => {
    const valid = new Set(['basics', 'story', 'title', 'goal', 'media']);
    const r = evaluateDonorView({
      title: '', description: '', goalCents: 0, coverImageUrl: '', imageCount: 0,
      forSelf: 'false', beneficiaryName: '', category: '', country: '',
    });
    for (const c of r.checks) expect(valid.has(c.step)).toBe(true);
  });
});
