import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MARKET_LOCALE,
  MARKET_LOCALES,
  SUPPORTED_LOCALE_CODES,
  findMarketLocale,
  isSupportedMarketLocale,
  normalizeLocale,
  resolveMarketLocale,
} from '../lib/i18n';

// ─────────────────────────────────────────────────────────────────────────────
// The footer picker offers MARKET locales ('es-MX'), while `profiles.language`
// and /api/settings speak LANGUAGE locales ('es'). Every market locale must map
// cleanly down to a language the rest of the app already accepts, or choosing
// "Español (México)" writes a value the settings API rejects.
// ─────────────────────────────────────────────────────────────────────────────

describe('market locales stay compatible with the language-level system', () => {
  it.each(MARKET_LOCALES)('$tag maps to a supported language', (locale) => {
    expect(SUPPORTED_LOCALE_CODES).toContain(locale.language);
    // What the locale API actually persists into profiles.language.
    expect(normalizeLocale(locale.language)).toBe(locale.language);
  });

  it('has no duplicate tags', () => {
    const tags = MARKET_LOCALES.map((l) => l.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('the default is present in the list', () => {
    expect(findMarketLocale(DEFAULT_MARKET_LOCALE)).toBeDefined();
  });

  it('distinguishes regions that share a language', () => {
    // The whole reason for market locales: one Spanish entry would have made
    // "Español (México)" and "Español (España)" the same choice.
    const spanish = MARKET_LOCALES.filter((l) => l.language === 'es').map((l) => l.tag);
    expect(spanish).toEqual(expect.arrayContaining(['es-ES', 'es-MX', 'es-US']));
    const french = MARKET_LOCALES.filter((l) => l.language === 'fr').map((l) => l.tag);
    expect(french).toEqual(expect.arrayContaining(['fr-CA', 'fr-FR']));
  });

  it('every entry carries what both the trigger and the menu render', () => {
    for (const locale of MARKET_LOCALES) {
      expect(locale.nativeLabel, `${locale.tag} nativeLabel`).toBeTruthy();
      expect(locale.countryName, `${locale.tag} countryName`).toBeTruthy();
      expect(locale.languageName, `${locale.tag} languageName`).toBeTruthy();
      expect(locale.flag, `${locale.tag} flag`).toBeTruthy();
      expect(locale.tag).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });
});

describe('locale resolution never leaves the picker without a value', () => {
  it('accepts an exact tag', () => {
    expect(resolveMarketLocale('es-MX').tag).toBe('es-MX');
  });

  it('is case-insensitive on lookup', () => {
    expect(findMarketLocale('ES-mx')?.tag).toBe('es-MX');
  });

  it('upgrades a bare language to that language\'s first market', () => {
    // A profile whose `language` predates the picker must not land on English.
    expect(resolveMarketLocale('es').language).toBe('es');
    expect(resolveMarketLocale('pt').language).toBe('pt');
  });

  it.each([null, undefined, '', '   ', 'zz-ZZ', 'klingon'])(
    'falls back to the default for %s',
    (value) => {
      expect(resolveMarketLocale(value).tag).toBe(DEFAULT_MARKET_LOCALE);
    },
  );

  it('rejects unknown tags rather than coercing them', () => {
    // The POST handler 400s on these instead of silently storing English — a
    // picker that appears to accept a choice and then shows another is worse
    // than a visible error.
    expect(isSupportedMarketLocale('es-AR')).toBe(false);
    expect(isSupportedMarketLocale('en-US')).toBe(true);
  });
});
