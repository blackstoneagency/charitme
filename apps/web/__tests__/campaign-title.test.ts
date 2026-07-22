import { describe, it, expect } from 'vitest';
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
