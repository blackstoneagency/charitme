import { describe, it, expect } from 'vitest';
import {
  isSupportedLocale,
  normalizeLocale,
  negotiateLocale,
  t,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALE_CODES,
} from '../lib/i18n';

describe('isSupportedLocale / normalizeLocale', () => {
  it('recognizes supported primary codes and region variants', () => {
    expect(isSupportedLocale('fr')).toBe(true);
    expect(isSupportedLocale('fr-CH')).toBe(true);
    expect(isSupportedLocale('EN')).toBe(true);
    expect(isSupportedLocale('ja')).toBe(false);
  });

  it('normalizes to a supported primary code or the default', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('DE')).toBe('de');
    expect(normalizeLocale('ja-JP')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('every normalized value is itself supported', () => {
    for (const code of ['en', 'fr-CA', 'zz', '', 'PT-br']) {
      expect(SUPPORTED_LOCALE_CODES).toContain(normalizeLocale(code));
    }
  });
});

describe('negotiateLocale (Accept-Language)', () => {
  it('returns default for an empty/missing header', () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('picks the highest-q supported locale', () => {
    // en has higher q than fr → but both supported; fr-CH is first with q=1
    expect(negotiateLocale('fr-CH, fr;q=0.9, en;q=0.8')).toBe('fr');
  });

  it('skips unsupported higher-q tags and falls to the next supported one', () => {
    expect(negotiateLocale('ja;q=1.0, de;q=0.7')).toBe('de');
  });

  it('falls back to default when nothing is supported', () => {
    expect(negotiateLocale('ja, ko;q=0.9, zh;q=0.8')).toBe(DEFAULT_LOCALE);
  });

  it('handles a bare primary tag with implicit q=1', () => {
    expect(negotiateLocale('es')).toBe('es');
  });

  it('orders strictly by q, not by header position', () => {
    expect(negotiateLocale('de;q=0.2, es;q=0.9')).toBe('es');
  });
});

describe('t (translation + interpolation)', () => {
  it('returns the English string for a known key', () => {
    expect(t('donate.button')).toBe('Donate now');
  });

  it('falls back to English for a locale without a dictionary', () => {
    expect(t('nav.discover', 'fr')).toBe('Discover');
  });

  it('returns the key itself when unknown (never throws/blank)', () => {
    expect(t('totally.missing.key')).toBe('totally.missing.key');
  });

  it('substitutes {placeholder} vars', () => {
    expect(t('campaign.raised_of_goal', 'en', { goal: '$5,000' })).toBe('raised of $5,000 goal');
  });

  it('coerces numeric vars and replaces all occurrences', () => {
    // key falls back to itself, exercising replaceAll on the raw key text
    expect(t('{n} of {n}', 'en', { n: 3 })).toBe('3 of 3');
  });
});
