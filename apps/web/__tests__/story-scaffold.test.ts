import { describe, it, expect } from 'vitest';
import {
  STORY_SECTIONS,
  emptySections,
  composeStory,
  sectionsFromText,
  sectionsFilled,
  TONE_PRESETS,
  toneById,
} from '../lib/story-scaffold';

describe('story scaffold', () => {
  it('composes only non-empty sections, in canonical order, as paragraphs', () => {
    const s = emptySections();
    s.intro = '  I am Dana.  ';
    s.solution = 'Funds cover rent.';
    s.ask = 'Please help.';
    // problem left blank — must be skipped, order preserved
    expect(composeStory(s)).toBe('I am Dana.\n\nFunds cover rent.\n\nPlease help.');
  });

  it('composes an empty scaffold to an empty string', () => {
    expect(composeStory(emptySections())).toBe('');
  });

  it('round-trips: sectionsFromText then composeStory preserves the paragraphs', () => {
    const text = 'Intro para.\n\nProblem para.\n\nSolution para.\n\nAsk para.';
    const parsed = sectionsFromText(text);
    expect(parsed.intro).toBe('Intro para.');
    expect(parsed.ask).toBe('Ask para.');
    expect(composeStory(parsed)).toBe(text);
  });

  it('never drops content: surplus paragraphs fold into the final section', () => {
    const text = 'A\n\nB\n\nC\n\nD\n\nE\n\nF';
    const parsed = sectionsFromText(text);
    // extra paragraphs (E, F) merge into the last section (ask)
    expect(parsed.ask).toBe('D\n\nE\n\nF');
    expect(composeStory(parsed)).toBe(text);
  });

  it('seeds an empty scaffold from empty/blank text', () => {
    expect(sectionsFromText('')).toEqual(emptySections());
    expect(sectionsFromText('   \n\n  ')).toEqual(emptySections());
  });

  it('counts only meaningfully-filled sections', () => {
    const s = emptySections();
    s.intro = 'This is a full intro sentence.';
    s.problem = 'tiny'; // < 15 chars, does not count
    expect(sectionsFilled(s)).toBe(1);
    expect(STORY_SECTIONS).toHaveLength(4);
  });

  it('exposes tone presets with a default "authentic" mapping', () => {
    expect(TONE_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(toneById('authentic')?.tone).toBe('authentic');
    expect(toneById('nope')).toBeUndefined();
    // every preset carries a non-empty AI tone value
    for (const p of TONE_PRESETS) expect(p.tone.length).toBeGreaterThan(0);
  });
});
