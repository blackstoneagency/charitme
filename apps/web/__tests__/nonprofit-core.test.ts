import { describe, it, expect } from 'vitest';
import {
  isValidEin,
  normalizeEin,
  INVALID_EIN_PREFIXES,
  canTransitionVerification,
  NONPROFIT_VERIFICATION_STATUSES,
  type NonprofitVerificationStatus,
} from '../lib/nonprofit-core';

describe('EIN validation', () => {
  it('accepts a well-formed EIN in several input shapes', () => {
    expect(isValidEin('12-3456789')).toBe(true);
    expect(isValidEin('123456789')).toBe(true);
    expect(isValidEin('  12 3456789 ')).toBe(true);
  });

  it('rejects the wrong number of digits', () => {
    expect(isValidEin('12-345678')).toBe(false); // 8 digits
    expect(isValidEin('1234567890')).toBe(false); // 10 digits
    expect(isValidEin('')).toBe(false);
    expect(isValidEin('abc')).toBe(false);
  });

  it('rejects unassigned IRS campus prefixes and all-zero bodies', () => {
    for (const p of INVALID_EIN_PREFIXES) {
      expect(isValidEin(`${p}3456789`), p).toBe(false);
    }
    expect(isValidEin('000000000')).toBe(false);
  });

  it('normalizes a valid EIN to canonical XX-XXXXXXX form', () => {
    expect(normalizeEin('123456789')).toBe('12-3456789');
    expect(normalizeEin('12-3456789')).toBe('12-3456789');
    expect(normalizeEin(' 12 3456789 ')).toBe('12-3456789');
  });

  it('returns null when normalizing an invalid EIN', () => {
    expect(normalizeEin('00-1234567')).toBeNull();
    expect(normalizeEin('123')).toBeNull();
  });
});

describe('nonprofit verification status machine', () => {
  it('exposes exactly the four statuses', () => {
    expect([...NONPROFIT_VERIFICATION_STATUSES].sort()).toEqual(
      ['pending', 'rejected', 'unverified', 'verified'],
    );
  });

  it('allows submitting for review and an admin decision', () => {
    expect(canTransitionVerification('unverified', 'pending')).toBe(true);
    expect(canTransitionVerification('pending', 'verified')).toBe(true);
    expect(canTransitionVerification('pending', 'rejected')).toBe(true);
    expect(canTransitionVerification('rejected', 'pending')).toBe(true);
  });

  it('allows revoking a verified org back to review/rejected', () => {
    expect(canTransitionVerification('verified', 'pending')).toBe(true);
    expect(canTransitionVerification('verified', 'rejected')).toBe(true);
  });

  it('forbids skipping review to jump straight to verified', () => {
    expect(canTransitionVerification('unverified', 'verified')).toBe(false);
    expect(canTransitionVerification('rejected', 'verified')).toBe(false);
    expect(canTransitionVerification('unverified', 'rejected')).toBe(false);
  });

  it('treats a same-status transition as an idempotent no-op', () => {
    for (const s of NONPROFIT_VERIFICATION_STATUSES) {
      expect(canTransitionVerification(s as NonprofitVerificationStatus, s as NonprofitVerificationStatus)).toBe(true);
    }
  });
});
