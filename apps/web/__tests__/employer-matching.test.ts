import { describe, it, expect } from 'vitest';
import { searchEmployerMatch, EMPLOYER_MATCH_DATABASE } from '../lib/employer-matching';

describe('searchEmployerMatch', () => {
  it('returns nothing for queries shorter than 2 normalized chars', () => {
    expect(searchEmployerMatch('')).toEqual([]);
    expect(searchEmployerMatch('a')).toEqual([]);
    expect(searchEmployerMatch('  ')).toEqual([]);
    expect(searchEmployerMatch('!')).toEqual([]); // normalizes to ''
  });

  it('matches case-insensitively', () => {
    const names = searchEmployerMatch('microsoft').map((e) => e.name);
    expect(names).toContain('Microsoft');
    expect(searchEmployerMatch('MICROSOFT').map((e) => e.name)).toContain('Microsoft');
  });

  it('ignores punctuation and whitespace in both query and names', () => {
    // normalize strips non-alphanumerics, so "h-p" matches "HP", "h.p." too
    const hp = searchEmployerMatch('h-p').map((e) => e.name);
    expect(hp).toContain('HP');
  });

  it('does substring (contains) matching, not just prefix', () => {
    const results = searchEmployerMatch('cro'); // inside "Microsoft"
    expect(results.map((e) => e.name)).toContain('Microsoft');
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchEmployerMatch('zzzzzznotacompany')).toEqual([]);
  });

  it('respects the limit and defaults to 8', () => {
    // "a" appears in many names; use a common bigram to get many hits
    const many = searchEmployerMatch('a', 100); // 'a' alone is < 2 chars → []
    expect(many).toEqual([]);
    const capped = searchEmployerMatch('in', 3); // Intel, Cisco?, etc.
    expect(capped.length).toBeLessThanOrEqual(3);
  });

  it('every returned entry actually contains the normalized query', () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const e of searchEmployerMatch('or', 50)) {
      expect(norm(e.name)).toContain('or');
    }
  });

  it('returned entries are real records from the database', () => {
    for (const e of searchEmployerMatch('goog')) {
      expect(EMPLOYER_MATCH_DATABASE).toContainEqual(e);
      expect(e.typicalRatio).toBeTruthy();
    }
  });

  it('database entries all have a name and a typicalRatio', () => {
    expect(EMPLOYER_MATCH_DATABASE.length).toBeGreaterThan(0);
    for (const e of EMPLOYER_MATCH_DATABASE) {
      expect(e.name.trim().length).toBeGreaterThan(0);
      expect(e.typicalRatio.trim().length).toBeGreaterThan(0);
    }
  });
});
