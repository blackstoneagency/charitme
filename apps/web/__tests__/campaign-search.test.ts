import { describe, it, expect } from 'vitest';
import {
  searchTerms,
  orClauseForTerm,
  applyCampaignSearch,
  CAMPAIGN_SEARCH_FIELDS,
} from '../lib/campaign-search';

describe('searchTerms', () => {
  it('splits a multi-word query into individual terms', () => {
    expect(searchTerms('cancer treatment fund')).toEqual(['cancer', 'treatment', 'fund']);
  });

  it('collapses extra whitespace', () => {
    expect(searchTerms('  help   kids  ')).toEqual(['help', 'kids']);
  });

  it('strips PostgREST filter-syntax chars so .or() cannot be broken/injected', () => {
    // commas and parens must never reach the filter string
    expect(searchTerms('Smith, John (urgent)')).toEqual(['Smith', 'John', 'urgent']);
  });

  it('neutralizes ilike wildcards so a search cannot become match-everything', () => {
    expect(searchTerms('%_ %')).toEqual([]);
    expect(searchTerms('a%b')).toEqual(['a', 'b']);
  });

  it('caps the number of terms to bound the generated filter', () => {
    const many = Array.from({ length: 20 }, (_, i) => `t${i}`).join(' ');
    expect(searchTerms(many)).toHaveLength(6);
  });

  it('returns nothing for a blank or all-punctuation query', () => {
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
    expect(searchTerms('(),')).toEqual([]);
  });
});

describe('orClauseForTerm', () => {
  it('ORs a term across all default fields', () => {
    expect(orClauseForTerm('cancer')).toBe(
      'title.ilike.%cancer%,tagline.ilike.%cancer%,description.ilike.%cancer%',
    );
  });

  it('honors a custom field list', () => {
    expect(orClauseForTerm('x', ['title'])).toBe('title.ilike.%x%');
  });

  it('covers exactly the documented searchable fields', () => {
    expect(CAMPAIGN_SEARCH_FIELDS).toEqual(['title', 'tagline', 'description']);
  });
});

describe('applyCampaignSearch', () => {
  // A fake PostgREST builder that records each .or() call and returns itself.
  function fakeQuery() {
    const calls: string[] = [];
    const q = { calls, or(f: string) { calls.push(f); return q; } };
    return q;
  }

  it('chains one .or() per term (AND across terms, OR across fields)', () => {
    const q = fakeQuery();
    applyCampaignSearch(q, 'cancer treatment');
    expect(q.calls).toEqual([
      'title.ilike.%cancer%,tagline.ilike.%cancer%,description.ilike.%cancer%',
      'title.ilike.%treatment%,tagline.ilike.%treatment%,description.ilike.%treatment%',
    ]);
  });

  it('is a no-op for empty/null/undefined queries', () => {
    for (const raw of [undefined, null, '', '   ']) {
      const q = fakeQuery();
      applyCampaignSearch(q, raw);
      expect(q.calls).toEqual([]);
    }
  });

  it('returns the same builder instance (so callers can keep chaining)', () => {
    const q = fakeQuery();
    expect(applyCampaignSearch(q, 'hello')).toBe(q);
  });
});
