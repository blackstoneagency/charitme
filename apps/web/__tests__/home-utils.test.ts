import { describe, expect, it } from 'vitest';
import { formatHomeCents, normalizeStoryFilters, shortHomeCount } from '../lib/home-utils';

describe('homepage story utilities', () => {
  it('normalizes unsupported filters to the public defaults', () => {
    expect(normalizeStoryFilters({
      storyCategory: 'unknown',
      storyQ: '  medical, urgent (family)  ',
      storySort: 'popular',
    })).toEqual({
      storyCategory: '',
      storyQ: 'medical urgent family',
      storySort: 'latest',
    });
  });

  it('keeps supported filters for Supabase story queries', () => {
    expect(normalizeStoryFilters({
      storyCategory: 'nonprofits',
      storyQ: 'schools',
      storySort: 'donors',
    })).toEqual({
      storyCategory: 'nonprofits',
      storyQ: 'schools',
      storySort: 'donors',
    });
  });

  it('formats homepage totals without floating money storage', () => {
    expect(formatHomeCents(6_300_000_00)).toBe('$6.3M');
    expect(shortHomeCount(12_400)).toBe('12.4K');
  });
});
