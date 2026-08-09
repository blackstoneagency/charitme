import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateBuilderStep } from '../lib/builder-validation';
import { PUBLISH_MIN_STORY_CHARS, PUBLISH_MIN_GOAL_CENTS } from '../lib/campaign-readiness';

// ─────────────────────────────────────────────────────────────────────────────
// Campaign builder — per-step validation and, crucially, WHICH field each
// failure targets. The component uses that field to set aria-invalid /
// aria-describedby and to move focus onto the offending input.
//
// The public browser sweep verifies that the guest builder renders, while these
// unit checks cover field targeting without needing to publish into a database.
// ─────────────────────────────────────────────────────────────────────────────

const base = { step: 'title', title: '', description: '', goalCents: 0, goalRaw: '' };

// The builder once *claimed* to mirror the server's publish rules and did not —
// that gap let a crafted request publish a 1-character story. These thresholds
// must therefore come from the single shared source, never be re-hardcoded here.
describe('thresholds come from the shared publish constants (no third copy)', () => {
  it('imports PUBLISH_MIN_* rather than literal numbers', () => {
    const src = readFileSync(join(__dirname, '..', 'lib', 'builder-validation.ts'), 'utf8');
    expect(src).toMatch(/import\s*\{[^}]*PUBLISH_MIN_STORY_CHARS[^}]*\}\s*from\s*['"]\.\/campaign-readiness['"]/);
    expect(src).toContain('PUBLISH_MIN_GOAL_CENTS');
    // no bare 20/100 thresholds left in the comparisons
    expect(src).not.toMatch(/length\s*<\s*20\b/);
    expect(src).not.toMatch(/goalCents\s*<\s*100\b/);
  });

  it('enforces exactly the shared story minimum', () => {
    const justUnder = 'x'.repeat(PUBLISH_MIN_STORY_CHARS - 1);
    const exactly   = 'x'.repeat(PUBLISH_MIN_STORY_CHARS);
    expect(validateBuilderStep({ ...base, step: 'story', description: justUnder })).toMatchObject({ field: 'description' });
    expect(validateBuilderStep({ ...base, step: 'story', description: exactly })).toBeNull();
  });

  it('enforces exactly the shared goal minimum', () => {
    expect(validateBuilderStep({ ...base, step: 'goal', goalRaw: 'x', goalCents: PUBLISH_MIN_GOAL_CENTS - 1 })).toMatchObject({ field: 'goal' });
    expect(validateBuilderStep({ ...base, step: 'goal', goalRaw: 'x', goalCents: PUBLISH_MIN_GOAL_CENTS })).toBeNull();
  });
});

describe('validateBuilderStep', () => {
  describe('title step', () => {
    it('rejects a too-short title and targets the title field', () => {
      expect(validateBuilderStep({ ...base, step: 'title', title: 'ab' }))
        .toMatchObject({ field: 'title' });
    });

    it('accepts a 3-character title', () => {
      expect(validateBuilderStep({ ...base, step: 'title', title: 'abc' })).toBeNull();
    });

    it('ignores surrounding whitespace when measuring', () => {
      expect(validateBuilderStep({ ...base, step: 'title', title: '  a  ' }))
        .toMatchObject({ field: 'title' });
    });
  });

  describe('story step', () => {
    it('lets an EMPTY story through — it is finishable later, and nagging is friction', () => {
      expect(validateBuilderStep({ ...base, step: 'story', description: '' })).toBeNull();
      expect(validateBuilderStep({ ...base, step: 'story', description: '   ' })).toBeNull();
    });

    it('rejects a started-but-too-short story and targets the description field', () => {
      expect(validateBuilderStep({ ...base, step: 'story', description: 'too short' }))
        .toMatchObject({ field: 'description' });
    });

    it('accepts a story at the 20-character threshold', () => {
      expect(validateBuilderStep({ ...base, step: 'story', description: 'x'.repeat(20) })).toBeNull();
    });
  });

  describe('goal step', () => {
    it('lets an EMPTY goal through (optional at this step)', () => {
      expect(validateBuilderStep({ ...base, step: 'goal', goalRaw: '', goalCents: 0 })).toBeNull();
    });

    it('rejects a goal under $1 and targets the goal field', () => {
      expect(validateBuilderStep({ ...base, step: 'goal', goalRaw: '0.50', goalCents: 50 }))
        .toMatchObject({ field: 'goal' });
    });

    it('accepts exactly $1', () => {
      expect(validateBuilderStep({ ...base, step: 'goal', goalRaw: '1', goalCents: 100 })).toBeNull();
    });
  });

  it('does not validate a field from a step the user is not on', () => {
    // A blank title must not block the story step — each step owns its own rule.
    expect(validateBuilderStep({ ...base, step: 'story', title: '', description: 'x'.repeat(25) }))
      .toBeNull();
    expect(validateBuilderStep({ ...base, step: 'goal', title: '', goalRaw: '500', goalCents: 50000 }))
      .toBeNull();
  });

  it('returns a non-empty message with every error, for the alert banner', () => {
    for (const input of [
      { ...base, step: 'title', title: 'a' },
      { ...base, step: 'story', description: 'short' },
      { ...base, step: 'goal', goalRaw: '0.1', goalCents: 10 },
    ]) {
      const err = validateBuilderStep(input);
      expect(err?.message.length).toBeGreaterThan(10);
    }
  });
});
