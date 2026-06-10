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
