import { describe, expect, it } from 'vitest';
import { extractCampaignFields, KNOWN_CATEGORIES } from '../lib/campaign-intake';

// The Build-with-AI path pre-fills the wizard from the organizer's free-text
// prompt so it asks fewer questions. These lock the deterministic extractor.
describe('extractCampaignFields — category', () => {
  it('detects medical causes', () => {
    expect(extractCampaignFields("Help cover my dad's cancer surgery").category).toBe('Medical');
  });
  it('detects memorials over generic family wording', () => {
    expect(extractCampaignFields('A memorial fund for my brother who passed away').category).toBe('Memorial');
  });
  it('detects emergencies (house fire)', () => {
    expect(extractCampaignFields('Our house fire left the family with nothing').category).toBe('Emergency');
  });
  it('detects education', () => {
    expect(extractCampaignFields('Scholarship fund to cover college tuition').category).toBe('Education');
  });
  it('detects animals', () => {
    expect(extractCampaignFields('Vet bills for my rescue dog').category).toBe('Animal');
  });
  it('returns no category when nothing matches', () => {
    expect(extractCampaignFields('Just some words with no signal here').category).toBeUndefined();
  });
  it('only ever returns a real shared category', () => {
    const c = extractCampaignFields('church ministry mission trip').category;
    expect(c).toBeDefined();
    expect(KNOWN_CATEGORIES.has(c as string)).toBe(true);
  });
});

describe('extractCampaignFields — goal', () => {
  it('parses a $-prefixed amount to cents', () => {
    expect(extractCampaignFields('We need to raise $5,000 for treatment').goalCents).toBe(500_000);
  });
  it('parses k/thousand suffixes', () => {
    expect(extractCampaignFields('Goal is 10k').goalCents).toBe(1_000_000);
    expect(extractCampaignFields('about 25 thousand dollars').goalCents).toBe(2_500_000);
  });
  it('takes the largest headline amount, not an aside', () => {
    expect(extractCampaignFields('replace 3 chairs; we need $8,000 total').goalCents).toBe(800_000);
  });
  it('does not read a bare small number as a goal', () => {
    expect(extractCampaignFields('replacing 3 chairs and 2 tables').goalCents).toBeUndefined();
  });
  it('floors a tiny amount to the $100 minimum', () => {
    expect(extractCampaignFields('just $20 dollars').goalCents).toBe(10_000);
  });
});

describe('extractCampaignFields — urgency + robustness', () => {
  it('flags urgent language', () => {
    expect(extractCampaignFields('We need help urgently, this is an emergency').urgency).toBe('urgent');
  });
  it('omits urgency when absent', () => {
    expect(extractCampaignFields('A calm long-term community garden project').urgency).toBeUndefined();
  });
  it('returns an empty object for empty input', () => {
    expect(extractCampaignFields('')).toEqual({});
    expect(extractCampaignFields('   ')).toEqual({});
  });
});
