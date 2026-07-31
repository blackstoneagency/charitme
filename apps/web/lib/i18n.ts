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
export function resolveMarketLocale(value: string | null | undefined): MarketLocale {
  const exact = findMarketLocale(value);
  if (exact) return exact;
  const primary = (value ?? '').trim().toLowerCase().split('-')[0];
  const byLanguage = MARKET_LOCALES.find((l) => l.language === primary);
  return byLanguage ?? findMarketLocale(DEFAULT_MARKET_LOCALE)!;
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

export type Dictionary = Record<string, string>;

const en: Dictionary = {
  'donate.button': 'Donate now',
  'donate.once': 'Give once',
  'donate.monthly': 'Monthly',
  'campaign.raised_of_goal': 'raised of {goal} goal',
  'campaign.share': 'Share',
  'nav.start_campaign': 'Start a campaign',
  'nav.discover': 'Discover',
  'nav.sign_in': 'Sign in',
};

const DICTIONARIES: Record<string, Dictionary> = { en };

/** Translate a key with {placeholder} substitution; falls back to English, then the key itself. */
export function t(key: string, locale: string = DEFAULT_LOCALE, vars?: Record<string, string | number>): string {
  const dict = DICTIONARIES[normalizeLocale(locale)] ?? DICTIONARIES[DEFAULT_LOCALE];
  let out = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}
