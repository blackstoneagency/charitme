import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DONATION_STEPS,
  DONATION_STEP_META,
  ownedSteps,
  stepPosition,
  nextStep,
  previousStep,
  canGoBack,
  DEDICATION_KINDS,
  DEDICATION_PREFIX,
  isDedicationKind,
  composeDedicatedMessage,
  isValidDedication,
  validateAmountCents,
  DONATION_MESSAGE_MAX,
  DEDICATION_NAME_MAX,
} from '../lib/donation-flow-core';
import { MIN_DONATION_CENTS } from '@shared/fees';

describe('the flow has all twelve steps from the reference', () => {
  it('is twelve, in order', () => {
    expect(DONATION_STEPS).toHaveLength(12);
    expect(DONATION_STEPS[0]).toBe('campaign');
    expect(DONATION_STEPS[11]).toBe('return');
  });

  it('names every step, so no panel renders blank', () => {
    for (const step of DONATION_STEPS) {
      expect(DONATION_STEP_META[step].title.length).toBeGreaterThan(0);
    }
  });

  it('positions are 1-based, because they are announced as "Step N of 12"', () => {
    expect(stepPosition('campaign')).toEqual({ index: 1, total: 12 });
    expect(stepPosition('return')).toEqual({ index: 12, total: 12 });
  });

  it('walks forward and back symmetrically', () => {
    for (let i = 0; i < DONATION_STEPS.length - 1; i += 1) {
      const here = DONATION_STEPS[i]!;
      expect(nextStep(here)).toBe(DONATION_STEPS[i + 1]);
      expect(previousStep(DONATION_STEPS[i + 1]!)).toBe(here);
    }
    expect(nextStep('return')).toBeNull();
    expect(previousStep('campaign')).toBeNull();
  });
});

describe('card entry is Stripe-hosted, and this repo NEVER renders a PAN field', () => {
  it('marks payment method, payment details and confirm as hosted', () => {
    // The artwork shows a raw card-number / expiry / CVC form. Building it would
    // put this site in PCI-DSS scope and route real card numbers through our own
    // server. Stripe Checkout renders those steps on Stripe's domain instead.
    for (const step of ['payment-method', 'payment-details', 'confirm'] as const) {
      expect(DONATION_STEP_META[step].hostedByStripe).toBe(true);
    }
    expect(ownedSteps()).not.toContain('payment-details');
  });

  it('no component in the app renders a card-number input', () => {
    // The guard that matters: this must stay true no matter what an artwork
    // shows. Card data belongs to Stripe, full stop.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(full) && !full.includes('__tests__')) files.push(full);
      }
    };
    for (const root of ['app', 'components']) walk(join(__dirname, '..', root));

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // autocomplete="cc-number" / "cc-csc" / "cc-exp" are the unambiguous
      // markers of a real card form. Stripe's own iframes are not in our source.
      if (/autoComplete=["'](cc-number|cc-csc|cc-exp)/.test(src)) {
        offenders.push(file.split('/apps/web/')[1] ?? file);
      }
    }
    expect(
      offenders,
      `these render raw card fields — card data must go to Stripe, never our server:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

describe('canGoBack', () => {
  it('allows going back before payment', () => {
    expect(canGoBack('amount')).toBe(true);
    expect(canGoBack('review')).toBe(true);
  });

  it('refuses to go back once the money has moved', () => {
    // "Back" after a completed donation would reopen the form and invite a
    // second charge for a gift already made.
    for (const step of ['success', 'receipt', 'share', 'return'] as const) {
      expect(canGoBack(step), `${step} must not offer Back`).toBe(false);
      expect(DONATION_STEP_META[step].postPayment).toBe(true);
    }
  });

  it('has nothing before the first step', () => {
    expect(canGoBack('campaign')).toBe(false);
  });
});

describe('dedication', () => {
  it('has no table and no honoree columns, which is why it folds into the message', () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    expect(schema).not.toContain('CREATE TABLE public.dedications');
    const match = /CREATE TABLE public\.donations \(([\s\S]*?)\n\);/.exec(schema);
    expect(match, 'donations moved').toBeTruthy();
    expect(match![1]).toContain('message');
    // If an honoree column ever lands, this fails and the fold-into-message
    // design should be revisited rather than left as a workaround.
    expect(match![1]).not.toContain('honoree');
  });

  it('recognises only the real kinds', () => {
    expect(isDedicationKind('memory')).toBe(true);
    expect(isDedicationKind('birthday')).toBe(false);
    expect(isDedicationKind(null)).toBe(false);
  });

  it('prefixes the message with the dedication', () => {
    const text = composeDedicatedMessage(
      { kind: 'memory', honoreeName: 'Ada Lovelace' },
      'She taught me to count.',
    );
    expect(text).toBe('In memory of Ada Lovelace. She taught me to count.');
  });

  it('works with no personal message', () => {
    expect(composeDedicatedMessage({ kind: 'honor', honoreeName: 'Sam' }, undefined))
      .toBe('In honour of Sam');
  });

  it('keeps the donor message when there is no dedication', () => {
    expect(composeDedicatedMessage(null, '  hello  ')).toBe('hello');
    expect(composeDedicatedMessage(null, undefined)).toBe('');
  });

  it('ignores a dedication with a blank name rather than writing a dangling prefix', () => {
    // "In memory of ." on a public donor wall is worse than no dedication.
    expect(composeDedicatedMessage({ kind: 'memory', honoreeName: '   ' }, 'hi')).toBe('hi');
  });

  it('puts the dedication FIRST so a long note cannot truncate it away', () => {
    const long = 'x'.repeat(DONATION_MESSAGE_MAX * 2);
    const text = composeDedicatedMessage({ kind: 'honor', honoreeName: 'Ada' }, long);
    expect(text.startsWith('In honour of Ada.')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(DONATION_MESSAGE_MAX);
  });

  it('names every kind', () => {
    for (const kind of DEDICATION_KINDS) {
      expect(DEDICATION_PREFIX[kind].length).toBeGreaterThan(0);
    }
  });

  it('validates the honoree name length', () => {
    expect(isValidDedication({ kind: 'honor', honoreeName: '' })).toBe(false);
    expect(isValidDedication({ kind: 'honor', honoreeName: 'A' })).toBe(true);
    expect(isValidDedication({ kind: 'honor', honoreeName: 'x'.repeat(DEDICATION_NAME_MAX) })).toBe(true);
    expect(isValidDedication({ kind: 'honor', honoreeName: 'x'.repeat(DEDICATION_NAME_MAX + 1) })).toBe(false);
  });
});

describe('validateAmountCents', () => {
  it('accepts an amount at or above the shared minimum', () => {
    expect(validateAmountCents(MIN_DONATION_CENTS, MIN_DONATION_CENTS)).toEqual({ ok: true });
    expect(validateAmountCents(5_000, MIN_DONATION_CENTS)).toEqual({ ok: true });
  });

  it('says WHY it refused, not just that it did', () => {
    const tooSmall = validateAmountCents(1, MIN_DONATION_CENTS);
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.reason).toContain('minimum');
  });

  it('rejects a fractional cent, which Stripe would refuse anyway', () => {
    // A float multiplied by 100 lands here as 1234.0000000002.
    const result = validateAmountCents(1234.0000000002, MIN_DONATION_CENTS);
    expect(result.ok).toBe(false);
  });

  it('rejects NaN and Infinity rather than passing them to Stripe', () => {
    expect(validateAmountCents(Number.NaN, MIN_DONATION_CENTS).ok).toBe(false);
    expect(validateAmountCents(Number.POSITIVE_INFINITY, MIN_DONATION_CENTS).ok).toBe(false);
  });

  it('uses the SHARED minimum, so it cannot drift from the API that enforces it', () => {
    expect(MIN_DONATION_CENTS).toBeGreaterThan(0);
  });
});
