import { describe, it, expect } from 'vitest';
import { validateEmailAddress } from '../lib/email-validation';

describe('validateEmailAddress — syntax', () => {
  it('accepts a normal address and normalizes it', () => {
    const r = validateEmailAddress('  John.Doe@Example.COM ');
    expect(r.email).toBe('john.doe@example.com');
    expect(r.syntaxOk).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.domain).toBe('example.com');
  });

  it.each([
    'plainaddress',
    '@no-local.com',
    'no-domain@',
    'two@@at.com',
    'spaces in@email.com',
    'trailingdot@domain.',
    'no-tld@localhost',
    '',
  ])('rejects malformed address %j', (bad) => {
    const r = validateEmailAddress(bad);
    expect(r.syntaxOk).toBe(false);
    expect(r.valid).toBe(false);
    expect(r.score).toBe(0);
    expect(r.reasons).toContain('Address does not look like a valid email');
  });

  it('rejects an address longer than 254 chars even if shaped like an email', () => {
    const long = `${'a'.repeat(250)}@ex.com`;
    expect(validateEmailAddress(long).syntaxOk).toBe(false);
  });

  it('handles null/undefined input without throwing', () => {
    // @ts-expect-error exercising the runtime guard
    expect(validateEmailAddress(undefined).valid).toBe(false);
    // @ts-expect-error exercising the runtime guard
    expect(validateEmailAddress(null).syntaxOk).toBe(false);
  });
});

describe('validateEmailAddress — classification flags', () => {
  it('flags disposable domains as the one hard fail', () => {
    const r = validateEmailAddress('someone@mailinator.com');
    expect(r.disposable).toBe(true);
    expect(r.valid).toBe(false); // hard fail for outreach
    expect(r.score).toBeLessThanOrEqual(30);
    expect(r.reasons).toContain('Disposable / temporary-mail domain');
  });

  it('flags role-based inboxes but keeps them valid', () => {
    const r = validateEmailAddress('support@acme.com');
    expect(r.roleBased).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(75); // 100 - 25
  });

  it('flags free providers informationally (still valid, no score penalty)', () => {
    const r = validateEmailAddress('jane@gmail.com');
    expect(r.freeProvider).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.score).toBe(100);
    expect(r.reasons).toContain('Personal free-mail provider');
  });

  it('suggests a fix for a common domain typo and penalizes the score', () => {
    const r = validateEmailAddress('jane@gmial.com');
    expect(r.suggestion).toBe('jane@gmail.com');
    expect(r.score).toBe(80); // 100 - 20
    expect(r.reasons.some((x) => x.includes('did you mean jane@gmail.com'))).toBe(true);
  });

  it('a clean corporate address scores 100 with a positive note', () => {
    const r = validateEmailAddress('priya@charitme.com');
    expect(r.score).toBe(100);
    expect(r.disposable).toBe(false);
    expect(r.roleBased).toBe(false);
    expect(r.freeProvider).toBe(false);
    expect(r.reasons).toContain('Looks deliverable');
  });

  it('stacks penalties (role-based + typo) and clamps score to [0,100]', () => {
    const r = validateEmailAddress('info@gmial.com');
    expect(r.roleBased).toBe(true);
    expect(r.suggestion).toBe('info@gmail.com');
    expect(r.score).toBe(55); // 100 - 25 - 20
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('never returns a negative score for a maximally-bad-but-parseable address', () => {
    const r = validateEmailAddress('admin@mohmal.com'); // disposable + role-based
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.valid).toBe(false);
  });

  it('is case-insensitive for domain classification', () => {
    expect(validateEmailAddress('X@MAILINATOR.COM').disposable).toBe(true);
    expect(validateEmailAddress('X@GMAIL.COM').freeProvider).toBe(true);
  });
});
