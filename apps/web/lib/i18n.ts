// ─────────────────────────────────────────────────────────────────────────────
// i18n groundwork.
//
// Locale negotiation + the translation-dictionary shape the UI will adopt
// incrementally. `profiles.language` already exists in the schema (default
// 'en'); this module is the single source of truth for which locales the
// product recognizes and how a request's locale is determined.
// ─────────────────────────────────────────────────────────────────────────────

export interface LocaleInfo {
  code: string;        // BCP 47 primary language subtag
  name: string;        // English name
  nativeName: string;  // self-name shown in pickers
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English',    nativeName: 'English' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español' },
  { code: 'fr', name: 'French',     nativeName: 'Français' },
  { code: 'de', name: 'German',     nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian',    nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch',      nativeName: 'Nederlands' },
];

export const DEFAULT_LOCALE = 'en';

// ─────────────────────────────────────────────────────────────────────────────
// Market locales — what the footer picker offers.
//
// SUPPORTED_LOCALES above is language-level ('es'), which is the right grain for
// choosing a translation file. It is the wrong grain for a locale picker: a
// donor in Mexico and one in Spain both want Spanish but different currency,
// date and address conventions, and the picker must show them as separate
// choices. Hence full BCP 47 market tags here, each mapping down to one of the
// language codes above for translation lookup and for `profiles.language`,
// which only ever stores the primary subtag.
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketLocale {
  /** Full BCP 47 tag, e.g. 'es-MX'. */
  tag: string;
  /** Language subtag — always a member of SUPPORTED_LOCALE_CODES. */
  language: string;
  /** ISO 3166-1 alpha-2 region. */
  region: string;
  /** Self-name as shown in the picker, e.g. 'Español (México)'. */
  nativeLabel: string;
  /** English country name for the collapsed trigger, e.g. 'Mexico'. */
  countryName: string;
  /** English language name for the collapsed trigger, e.g. 'Spanish'. */
  languageName: string;
  /** Flag emoji for the collapsed trigger. */
  flag: string;
}

export const MARKET_LOCALES: readonly MarketLocale[] = [
  { tag: 'en-US', language: 'en', region: 'US', nativeLabel: 'English (United States)',  countryName: 'United States',  languageName: 'English',    flag: '🇺🇸' },
  { tag: 'de-DE', language: 'de', region: 'DE', nativeLabel: 'Deutsch (Deutschland)',    countryName: 'Germany',        languageName: 'German',     flag: '🇩🇪' },
  { tag: 'en-GB', language: 'en', region: 'GB', nativeLabel: 'English (United Kingdom)', countryName: 'United Kingdom', languageName: 'English',    flag: '🇬🇧' },
  { tag: 'es-ES', language: 'es', region: 'ES', nativeLabel: 'Español (España)',         countryName: 'Spain',          languageName: 'Spanish',    flag: '🇪🇸' },
  { tag: 'es-MX', language: 'es', region: 'MX', nativeLabel: 'Español (México)',         countryName: 'Mexico',         languageName: 'Spanish',    flag: '🇲🇽' },
  { tag: 'es-US', language: 'es', region: 'US', nativeLabel: 'Español (Estados Unidos)', countryName: 'United States',  languageName: 'Spanish',    flag: '🇺🇸' },
  { tag: 'fr-CA', language: 'fr', region: 'CA', nativeLabel: 'Français (Canada)',        countryName: 'Canada',         languageName: 'French',     flag: '🇨🇦' },
  { tag: 'fr-FR', language: 'fr', region: 'FR', nativeLabel: 'Français (France)',        countryName: 'France',         languageName: 'French',     flag: '🇫🇷' },
  { tag: 'it-IT', language: 'it', region: 'IT', nativeLabel: 'Italiano (Italia)',        countryName: 'Italy',          languageName: 'Italian',    flag: '🇮🇹' },
  { tag: 'nl-NL', language: 'nl', region: 'NL', nativeLabel: 'Nederlands (Nederland)',   countryName: 'Netherlands',    languageName: 'Dutch',      flag: '🇳🇱' },
  { tag: 'pt-PT', language: 'pt', region: 'PT', nativeLabel: 'Português (Portugal)',     countryName: 'Portugal',       languageName: 'Portuguese', flag: '🇵🇹' },
];

export const DEFAULT_MARKET_LOCALE = 'en-US';

/** Cookie carrying the visitor's chosen market locale (anonymous or not). */
export const LOCALE_COOKIE = 'charitme_locale';

/**
 * Request header middleware uses to hand the resolved market tag to Server
 * Components. A header rather than re-reading the cookie downstream, so the
 * negotiation runs once per request and every consumer sees the same answer.
 */
export const LOCALE_HEADER = 'x-charitme-locale';

export function findMarketLocale(tag: string | null | undefined): MarketLocale | undefined {
  if (!tag) return undefined;
  const wanted = tag.trim().toLowerCase();
  return MARKET_LOCALES.find((l) => l.tag.toLowerCase() === wanted);
}

export function isSupportedMarketLocale(tag: string | null | undefined): boolean {
  return findMarketLocale(tag) !== undefined;
}

/**
 * Resolve a stored/negotiated value to a market locale, always returning one.
 *
 * Accepts an exact tag ('es-MX'), or a bare language ('es') which resolves to
 * that language's first listed market — so a profile whose `language` column
 * predates the picker still lands somewhere sensible instead of on English.
 */
/**
 * The market a bare language resolves to, e.g. 'fr' → 'fr-FR'.
 *
 * Explicit rather than "first matching entry in MARKET_LOCALES": with list order
 * deciding, a Swiss visitor (fr-CH) landed on fr-CA purely because Canada is
 * listed before France, and any bare 'es' landed on whichever Spanish market
 * happened to sort first. Exactly one market per language is named here, and a
 * test asserts that.
 */
export const PRIMARY_MARKET_BY_LANGUAGE: Readonly<Record<string, string>> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  nl: 'nl-NL',
  pt: 'pt-PT',
};

export function resolveMarketLocale(value: string | null | undefined): MarketLocale {
  const exact = findMarketLocale(value);
  if (exact) return exact;
  const primary = (value ?? '').trim().toLowerCase().split('-')[0];
  const preferred = PRIMARY_MARKET_BY_LANGUAGE[primary];
  const byLanguage = findMarketLocale(preferred) ?? MARKET_LOCALES.find((l) => l.language === primary);
  return byLanguage ?? findMarketLocale(DEFAULT_MARKET_LOCALE)!;
}

/**
 * Negotiate a MARKET locale from Accept-Language.
 *
 * `negotiateLocale` above answers at language grain ('fr'), which is right for
 * choosing a translation file and is what `profiles.language` stores. It is the
 * wrong grain for choosing a market: it discards the region the visitor actually
 * named, so a browser asking for es-MX — with es-MX shipped as its own market —
 * was resolved to 'es' and then to Spain. The visitor told us Mexico and we
 * ignored it.
 *
 * One pass, in the visitor's own order of preference, checking exact market then
 * language for each entry. A two-pass version (all exact matches, then all
 * language matches) would let a lower-ranked exact match beat a higher-ranked
 * language: "es-AR,fr-FR;q=0.9" would return French, which the visitor ranked
 * second.
 */
export function negotiateMarketLocale(acceptLanguage: string | null | undefined): MarketLocale {
  const fallback = findMarketLocale(DEFAULT_MARKET_LOCALE)!;
  if (!acceptLanguage) return fallback;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((r) => r.tag && r.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const exact = findMarketLocale(tag);
    if (exact) return exact;
    const language = tag.toLowerCase().split('-')[0];
    if (SUPPORTED_LOCALE_CODES.includes(language)) return resolveMarketLocale(language);
  }
  return fallback;
}

export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES.map(l => l.code);

export function isSupportedLocale(code: string): boolean {
  return SUPPORTED_LOCALE_CODES.includes(code.toLowerCase().split('-')[0]);
}

export function normalizeLocale(code: string | null | undefined): string {
  const primary = (code ?? '').toLowerCase().split('-')[0];
  return SUPPORTED_LOCALE_CODES.includes(primary) ? primary : DEFAULT_LOCALE;
}

/**
 * Pick the best supported locale from an Accept-Language header.
 * "fr-CH, fr;q=0.9, en;q=0.8" → 'fr'
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): string {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find(p => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0];
    if (SUPPORTED_LOCALE_CODES.includes(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

// ── Dictionary scaffold ──────────────────────────────────────────────────────
// UI strings migrate into these dictionaries incrementally; until a locale has
// a translation for a key, `t()` falls back to English so nothing ever breaks.

export type Dictionary = Readonly<Record<string, string>>;

// Dictionaries are REGISTERED rather than declared inline, by lib/locales, so the
// strings live in one file per language instead of growing this module without
// bound. Registration happens at import of lib/locales, which the root layout
// pulls in once.
//
// Two tiers, matching the two grains this file already draws a line between:
//   • base language ('es')   — carries the strings, the grain of SUPPORTED_LOCALES
//   • market override ('es-MX') — carries ONLY what that market really says
//     differently ("Configuración" vs "Ajustes", "Monto" vs "Importe")
// Eleven full dictionaries would be eleven copies drifting apart, which is the
// failure this repo already had with three copies of CAMPAIGN_CATEGORIES.
const DICTIONARIES: Record<string, Dictionary> = {};
const MARKET_OVERRIDES: Record<string, Dictionary> = {};

export function registerDictionary(code: string, dict: Dictionary): void {
  const tag = code.trim();
  if (tag.includes('-')) MARKET_OVERRIDES[normalizeMarketKey(tag)] = dict;
  else DICTIONARIES[tag.toLowerCase()] = dict;
}

function normalizeMarketKey(tag: string): string {
  const [lang, region] = tag.split(/[-_]/);
  return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
}

export function getDictionary(language: string): Dictionary {
  return DICTIONARIES[language] ?? {};
}

export function getMarketOverride(tag: string): Dictionary {
  return MARKET_OVERRIDES[normalizeMarketKey(tag)] ?? {};
}

/** Every key English defines — the denominator for any coverage claim. */
export function knownKeys(): string[] {
  return Object.keys(DICTIONARIES.en ?? {});
}

/**
 * Translate a key with {placeholder} substitution.
 *
 * `locale` may be a market tag ('es-MX') or a bare language ('es'); a market tag
 * consults that market's overrides first. Falls back to the base language, then
 * English, then the key itself — a visible key beats a blank UI.
 *
 * Substitution happens AFTER lookup so a translation may reorder its variables,
 * which German and Dutch need.
 */
export function t(key: string, locale: string = DEFAULT_LOCALE, vars?: Record<string, string | number>): string {
  const marketKey = normalizeMarketKey(locale ?? '');
  const language = normalizeLocale(locale);
  let out =
    MARKET_OVERRIDES[marketKey]?.[key] ??
    DICTIONARIES[language]?.[key] ??
    DICTIONARIES[DEFAULT_LOCALE]?.[key] ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/** Bind `t` to one locale — what components hold. */
export function translatorFor(locale: string) {
  return (key: string, vars?: Record<string, string | number>) => t(key, locale, vars);
}

/**
 * Keys a locale answers WITHOUT falling back to English. The honest number behind
 * any claim about how translated the site is.
 */
export function coverageFor(tag: string): { translated: number; total: number; missing: string[] } {
  const language = normalizeLocale(tag);
  const marketKey = normalizeMarketKey(tag);
  const missing: string[] = [];
  for (const key of knownKeys()) {
    const hit = MARKET_OVERRIDES[marketKey]?.[key] ?? DICTIONARIES[language]?.[key];
    if (hit === undefined) missing.push(key);
  }
  const total = knownKeys().length;
  return { translated: total - missing.length, total, missing };
}
