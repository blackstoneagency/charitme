import { describe, it, expect } from 'vitest';
import { totalPages } from '../lib/pagination';

describe('totalPages', () => {
  it('computes ceil(total / limit)', () => {
    expect(totalPages(60, 24)).toBe(3); // 60/24 = 2.5 → 3
    expect(totalPages(48, 24)).toBe(2); // exact multiple
    expect(totalPages(1, 24)).toBe(1);
  });

  it('returns at least 1 for an empty result set', () => {
    expect(totalPages(0, 24)).toBe(1);
  });

  it('never returns NaN or Infinity for a zero/negative limit', () => {
    expect(totalPages(100, 0)).toBe(1);
    expect(totalPages(100, -5)).toBe(1);
  });

  it('clamps a negative total to an empty list', () => {
    expect(totalPages(-10, 24)).toBe(1);
  });
});
