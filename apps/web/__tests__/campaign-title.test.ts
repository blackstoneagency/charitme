import { describe, it, expect } from 'vitest';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { suggestCampaignTitle } from '../lib/campaign-title';

describe('suggestCampaignTitle', () => {
  it('uses a named beneficiary + category phrase', () => {
    expect(suggestCampaignTitle({ category: 'Medical', beneficiaryName: 'Sarah' })).toBe('Help Sarah with medical expenses');
  });

  it('frames a self campaign', () => {
    expect(suggestCampaignTitle({ category: 'Education', forSelf: 'true' })).toBe('Support my education');
  });

  it('falls back to a someone-else framing', () => {
    expect(suggestCampaignTitle({ category: 'Animal', forSelf: 'false' })).toBe('Help support animal care');
  });

  it('handles an unknown/empty category', () => {
    expect(suggestCampaignTitle({ category: '', forSelf: 'false' })).toBe('Help support this cause');
    expect(suggestCampaignTitle({})).toBe('Help support this cause');
  });

  it('never returns empty and clamps to 80 chars', () => {
    const t = suggestCampaignTitle({ category: 'Medical', beneficiaryName: 'X'.repeat(200) });
    expect(t.length).toBeGreaterThan(0);
    expect(t.length).toBeLessThanOrEqual(80);
  });

  it('collapses whitespace in the beneficiary name', () => {
    expect(suggestCampaignTitle({ category: 'Family', beneficiaryName: '  the   Lee   family ' })).toBe('Help the Lee family with the family');
  });
});

describe('self-framed titles are grammatical for every category', () => {
  // Regression: the phrase map mixes bare nouns ('education') with phrases that
  // carry their own determiner ('the team', 'our cause', 'a creative project').
  // The "Support my ..." template pasted the latter straight in, producing
  // "Support my the team" for 11 of the 18 categories -- Sports, Competition and
  // Creative among them.
  it('never emits a doubled determiner', () => {
    const bad: string[] = [];
    for (const c of CAMPAIGN_CATEGORIES) {
      const t = suggestCampaignTitle({ category: c, forSelf: 'true' });
      if (/\bmy (the|our|a|an) \b/.test(t)) bad.push(`${c}: "${t}"`);
    }
    expect(bad, `ungrammatical self titles:\n${bad.join('\n')}`).toEqual([]);
  });

  it('reads naturally for the common youth causes', () => {
    expect(suggestCampaignTitle({ category: 'Sports', forSelf: 'true' })).toBe('Support my team');
    expect(suggestCampaignTitle({ category: 'Competition', forSelf: 'true' })).toBe('Support my team');
    expect(suggestCampaignTitle({ category: 'Creative', forSelf: 'true' })).toBe('Support my creative project');
  });

  it('falls back to a grammatical phrase with no category', () => {
    expect(suggestCampaignTitle({ forSelf: 'true' })).toBe('Support my cause');
  });
});
