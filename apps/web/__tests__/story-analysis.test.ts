import { describe, it, expect } from 'vitest';
import { analyzeStory } from '../lib/story-analysis';

const tone = (a: ReturnType<typeof analyzeStory>, id: string) => a.signals.find((s) => s.id === id)?.tone;

describe('analyzeStory', () => {
  it('flags a too-short story and a missing ask', () => {
    const a = analyzeStory('Money please');
    expect(a.wordCount).toBe(2);
    expect(tone(a, 'length')).toBe('warn');
  });

  it('rates a solid multi-paragraph story with specifics + an ask highly', () => {
    const text =
      'Our family lost everything in a house fire last week. We are asking for help to ' +
      'cover temporary housing and replace essentials for our three kids.\n\n' +
      'We need to raise $12,000 over the next 30 days to secure an apartment and buy ' +
      'beds, clothes, and school supplies. Every donation gets us closer to a stable home.';
    const a = analyzeStory(text);
    expect(tone(a, 'length')).toBe('good');
    expect(tone(a, 'structure')).toBe('good');
    expect(tone(a, 'specifics')).toBe('good');
    expect(tone(a, 'ask')).toBe('good');
    expect(tone(a, 'claims')).toBe('good');
  });

  it('warns on unverifiable / risky claims and names them', () => {
    const a = analyzeStory('Your donation is guaranteed to work a miracle and is tax-deductible.');
    expect(tone(a, 'claims')).toBe('warn');
    const detail = a.signals.find((s) => s.id === 'claims')?.detail ?? '';
    expect(detail).toMatch(/guaranteed/);
    expect(detail).toMatch(/miracle/);
    expect(detail).toMatch(/tax-deductible/);
  });

  it('single block prompts a structure suggestion', () => {
    const oneBlock = 'We are raising funds to help our community center reopen after the storm damaged the roof and floors this spring.';
    expect(tone(analyzeStory(oneBlock), 'structure')).toBe('ok');
  });

  it('always returns the five signal ids', () => {
    const ids = analyzeStory('anything').signals.map((s) => s.id).sort();
    expect(ids).toEqual(['ask', 'claims', 'length', 'specifics', 'structure']);
  });
});
