import { describe, it, expect } from 'vitest';
import { categoryQuery, unsplashCoverUrl } from '../lib/unsplash';

describe('categoryQuery', () => {
  it('maps a known category to a themed query', () => {
    expect(categoryQuery('Medical')).toBe('hospital healthcare');
    expect(categoryQuery('Education')).toBe('school classroom students');
  });

  it('falls back to a generic charity query for unknown/empty categories', () => {
    expect(categoryQuery('NoSuchCategory')).toBe('charity community help');
    expect(categoryQuery(null)).toBe('charity community help');
    expect(categoryQuery(undefined)).toBe('charity community help');
  });
});

describe('unsplashCoverUrl', () => {
  it('appends sizing/crop params to a raw URL that has no query string', () => {
    expect(unsplashCoverUrl('https://images.unsplash.com/photo-abc')).toBe(
      'https://images.unsplash.com/photo-abc?auto=format&fit=crop&crop=entropy&w=800&h=600&q=80',
    );
  });

  it('uses & when the raw URL already has a query string', () => {
    expect(unsplashCoverUrl('https://images.unsplash.com/photo-abc?ixid=xyz')).toBe(
      'https://images.unsplash.com/photo-abc?ixid=xyz&auto=format&fit=crop&crop=entropy&w=800&h=600&q=80',
    );
  });

  it('honors custom dimensions', () => {
    expect(unsplashCoverUrl('https://images.unsplash.com/photo-abc', 1200, 675)).toContain('w=1200&h=675');
  });
});
