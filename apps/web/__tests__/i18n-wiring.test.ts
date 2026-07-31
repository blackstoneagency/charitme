import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Automatic detection is only automatic while the wiring is present, and every
// piece below is INVISIBLE when it breaks — the site just renders English and
// looks fine. `negotiateLocale` shipped on master called from nowhere for exactly
// that reason. So each link in the chain is asserted rather than assumed.

const WEB = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(WEB, ...p), 'utf8');

describe('locale detection is wired end to end', () => {
  const middleware = read('middleware.ts');
  const layout = read('app', 'layout.tsx');

  it('middleware negotiates from Accept-Language when nothing is stored', () => {
    // Accept-Language IS the operating system's language setting as the browser
    // reports it. Without this the site can only be English until a visitor finds
    // the picker.
    expect(middleware).toMatch(/negotiateMarketLocale\(request\.headers\.get\('accept-language'\)\)/);
  });

  it('negotiation happens at MARKET grain, keeping the visitor region', () => {
    // The language-grain helper would resolve es-MX to 'es' and then to Spain.
    expect(middleware).not.toMatch(/resolveMarketLocale\(negotiateLocale\(/);
  });

  it('an explicit stored choice outranks the operating system', () => {
    expect(middleware).toMatch(/isSupportedMarketLocale\(storedLocale\)/);
  });

  it('the stored value is validated before use, never trusted', () => {
    // A hand-edited cookie is attacker-controlled input that lands in <html lang>.
    const cookieRead = middleware.indexOf('LOCALE_COOKIE');
    const validation = middleware.indexOf('isSupportedMarketLocale');
    expect(cookieRead).toBeGreaterThan(-1);
    expect(validation).toBeGreaterThan(cookieRead);
  });

  it('the resolved locale reaches Server Components', () => {
    expect(middleware).toMatch(/requestHeaders\.set\(LOCALE_HEADER, marketLocale\.tag\)/);
  });

  it('html lang is the resolved locale, not a hardcoded string', () => {
    // Screen readers choose pronunciation from this attribute; German read with
    // English phonetics is worse than untranslated text.
    expect(layout).toMatch(/<html lang=\{locale\}/);
    expect(layout).not.toMatch(/<html lang="en"/);
  });

  it('the provider wraps the app so client components can translate', () => {
    expect(layout).toMatch(/<LocaleProvider locale=\{locale\}>/);
  });

  it('no locale URL prefix was introduced', () => {
    // A /de/… prefix would rewrite every canonical URL, sitemap entry and share
    // link in the product and split each campaign's SEO across eleven paths.
    expect(middleware).not.toMatch(/redirect.*\$\{.*locale.*\}/);
  });
});

describe('dictionaries are bundled, not read at runtime', () => {
  it('the registry imports every dictionary statically', () => {
    const registry = read('lib', 'locales', 'index.ts');
    // `AI/` taught this lesson: Next's output file tracing does not ship a file
    // that is only required dynamically, so it worked in dev and was empty in
    // production. Static imports are traced.
    expect(registry).not.toMatch(/await import\(|require\(/);
    for (const lang of ['en', 'de', 'es', 'fr', 'it', 'nl', 'pt']) {
      expect(registry).toMatch(new RegExp(`from '\\./${lang}'`));
    }
  });

  it('registration happens on import so no caller can forget it', () => {
    const registry = read('lib', 'locales', 'index.ts');
    expect(registry).toMatch(/^registerAllDictionaries\(\);$/m);
  });
});
