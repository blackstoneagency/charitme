import { describe, it, expect } from 'vitest';
import {
  MARKET_LOCALES,
  SUPPORTED_LOCALE_CODES,
  PRIMARY_MARKET_BY_LANGUAGE,
  coverageFor,
  knownKeys,
  t,
  negotiateMarketLocale,
  resolveMarketLocale,
  getDictionary,
  getMarketOverride,
} from '../lib/i18n';
import '../lib/locales';
import { en } from '../lib/locales/en';

// The goal is "every word translated for every language in the dropdown". This
// file is the measurement behind that claim, written to FAIL rather than flatter:
// a locale that silently falls back to English is NOT translated, and coverage
// counts a key only when the locale answers it without falling back.

describe('translation coverage', () => {
  it('the key set is real, not empty', () => {
    // Non-vacuity: every assertion below iterates the English key set. If it were
    // empty they would all pass while nothing was translated.
    expect(knownKeys().length).toBeGreaterThan(150);
    expect(Object.keys(en).length).toBe(knownKeys().length);
  });

  it('every supported language answers every English key', () => {
    const gaps: string[] = [];
    for (const code of SUPPORTED_LOCALE_CODES) {
      if (code === 'en') continue;
      const dict = getDictionary(code);
      for (const key of knownKeys()) if (dict[key] === undefined) gaps.push(`${code}:${key}`);
    }
    expect(gaps).toEqual([]);
  });

  it('every market in the picker reaches 100% coverage', () => {
    const short = MARKET_LOCALES
      .map((m) => ({ tag: m.tag, ...coverageFor(m.tag) }))
      .filter((c) => c.translated < c.total)
      .map((c) => `${c.tag} ${c.translated}/${c.total} (missing ${c.missing.slice(0, 3).join(', ')}…)`);
    expect(short).toEqual([]);
  });

  it('no translation is left as the English string', () => {
    // Catches the copy-paste failure: a dictionary that "has" every key because
    // someone pasted English in. Words genuinely identical across languages are
    // listed explicitly rather than pattern-matched, so the exemption stays honest.
    const IDENTICAL_IS_FINE = new Set([
      'nav.menu', 'nav.profile', 'footer.blog', 'footer.cookies', 'footer.privacy',
      'auth.password', 'auth.email', 'settings.privacy', 'settings.account',
      'dashboard.title', 'nav.dashboard', 'campaign.updates', 'dashboard.updates',
      'donate.total', 'status.optional', 'action.filter', 'settings.notifications',
      'nav.search', 'action.search', 'campaign.faq', 'nav.settings', 'action.apply',
      'settings.theme', 'donate.processing_fee', 'settings.language_auto',
      'dashboard.analytics', 'footer.help', 'campaign.organizer', 'status.active',
      'action.copy', 'action.cancel', 'status.verified', 'nav.pricing',
      // 'Contact' is standard in French and Dutch; Dutch uses the English
      // loanword 'supporters' for exactly this meaning.
      'footer.contact', 'dashboard.supporters',
    ]);
    const leaks: string[] = [];
    for (const code of SUPPORTED_LOCALE_CODES) {
      if (code === 'en') continue;
      const dict = getDictionary(code);
      for (const [key, english] of Object.entries(en)) {
        if (IDENTICAL_IS_FINE.has(key)) continue;
        if (dict[key] === english) leaks.push(`${code}:${key}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('placeholders survive every translation', () => {
    // A dropped {goal} renders a sentence with a hole in it; a renamed one renders
    // a literal brace. Both are worse than untranslated English.
    const bad: string[] = [];
    for (const [key, english] of Object.entries(en)) {
      const wanted = [...english.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      if (!wanted) continue;
      for (const market of MARKET_LOCALES) {
        const got = [...t(key, market.tag).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
        if (got !== wanted) bad.push(`${market.tag}:${key}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('market overrides stay sparse and never restate their language', () => {
    // A market file exists to hold real differences. One repeating its base is a
    // second copy waiting to drift — the failure this repo already had with three
    // copies of CAMPAIGN_CATEGORIES.
    const redundant: string[] = [];
    for (const market of MARKET_LOCALES) {
      const override = getMarketOverride(market.tag);
      const base = getDictionary(market.language);
      for (const [key, value] of Object.entries(override)) {
        if (base[key] === value) redundant.push(`${market.tag}:${key}`);
      }
    }
    expect(redundant).toEqual([]);
  });
});

describe('market negotiation from the operating system', () => {
  it('keeps the region the visitor actually named', () => {
    // The language-grain negotiator discards it: a browser asking for es-MX was
    // resolved to 'es' and then to Spain, even though es-MX ships as its own
    // market. The visitor told us Mexico and we ignored it.
    expect(negotiateMarketLocale('es-MX,es;q=0.9').tag).toBe('es-MX');
    expect(negotiateMarketLocale('fr-CA,fr;q=0.9').tag).toBe('fr-CA');
    expect(negotiateMarketLocale('en-GB,en;q=0.9').tag).toBe('en-GB');
  });

  it('falls back to the language primary when the region is not offered', () => {
    expect(negotiateMarketLocale('fr-CH,fr;q=0.9').tag).toBe('fr-FR');
    expect(negotiateMarketLocale('es-AR,es;q=0.9').tag).toBe('es-ES');
    expect(negotiateMarketLocale('de-AT').tag).toBe('de-DE');
  });

  it('respects the visitor ranking over exactness', () => {
    // Spanish is their first choice with an unlisted region; French merely happens
    // to match a market we list. Returning French hands them their second choice.
    expect(negotiateMarketLocale('es-AR,fr-FR;q=0.9').tag).toBe('es-ES');
  });

  it('defaults for languages we do not translate', () => {
    expect(negotiateMarketLocale('ja-JP,ja;q=0.9').tag).toBe('en-US');
    expect(negotiateMarketLocale('').tag).toBe('en-US');
    expect(negotiateMarketLocale(null).tag).toBe('en-US');
  });

  it('ignores q=0, which means "explicitly not this one"', () => {
    expect(negotiateMarketLocale('de-DE;q=0,es-ES;q=0.5').tag).toBe('es-ES');
  });

  it('every language names exactly one primary market, and it exists', () => {
    // Without this, a bare language resolves by LIST ORDER — which sent a Swiss
    // visitor to Quebec French.
    for (const code of SUPPORTED_LOCALE_CODES) {
      const tag = PRIMARY_MARKET_BY_LANGUAGE[code];
      expect(tag, code).toBeTruthy();
      expect(MARKET_LOCALES.map((m) => m.tag)).toContain(tag);
      expect(resolveMarketLocale(code).tag).toBe(tag);
    }
  });
});

describe('lookup order', () => {
  it('market beats language, language beats English', () => {
    expect(t('auth.email', 'fr-CA')).toBe('Courriel');
    expect(t('auth.email', 'fr-FR')).toBe('Adresse e-mail');
    expect(t('auth.email', 'en-US')).toBe('Email');
  });

  it('an unknown key returns the key itself, never a blank', () => {
    expect(t('nothing.here.at.all', 'de-DE')).toBe('nothing.here.at.all');
  });

  it('substitutes placeholders after lookup so translations may reorder them', () => {
    expect(t('campaign.raised_of_goal', 'es-ES', { goal: '1.000 €' }))
      .toBe('recaudado de una meta de 1.000 €');
  });
});
