import { describe, expect, it } from 'vitest';
import { validateBuilderStep } from '../lib/builder-validation';

// ─────────────────────────────────────────────────────────────────────────────
// Campaign builder — per-step validation and, crucially, WHICH field each
// failure targets. The component uses that field to set aria-invalid /
// aria-describedby and to move focus onto the offending input.
//
// This is unit-tested rather than driven in a browser because /create is
// auth-gated and there is no database in CI, so the wizard can't be walked here.
// Without these, the field-targeting would ship unverified on the primary
// conversion path.
// ─────────────────────────────────────────────────────────────────────────────

const base = { step: 'title', title: '', description: '', goalCents: 0, goalRaw: '' };

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
