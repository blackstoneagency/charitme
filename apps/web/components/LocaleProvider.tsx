'use client';

import React, { createContext, useContext, useMemo } from 'react';
import {
  DEFAULT_MARKET_LOCALE,
  MARKET_LOCALES,
  resolveMarketLocale,
  t as translate,
  type MarketLocale,
} from '../lib/i18n';
import '../lib/locales';

interface LocaleContextValue {
  /** Full market tag, e.g. 'es-MX'. */
  locale: string;
  market: MarketLocale;
  /** Translate a key in the current locale. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  markets: readonly MarketLocale[];
}

// The default is a WORKING translator, not null or a thrown error. A client
// component rendered outside the provider — a portal, a test, a lazily mounted
// widget — then shows English instead of raw keys or a crash.
const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_MARKET_LOCALE,
  market: resolveMarketLocale(DEFAULT_MARKET_LOCALE),
  t: (key, vars) => translate(key, DEFAULT_MARKET_LOCALE, vars),
  markets: MARKET_LOCALES,
});

export function LocaleProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  const market = resolveMarketLocale(locale);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: market.tag,
      market,
      t: (key, vars) => translate(key, market.tag, vars),
      markets: MARKET_LOCALES,
    }),
    [market],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** `const { t, locale } = useLocale()` in any client component. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** Shorthand for the common case. */
export function useT() {
  return useContext(LocaleContext).t;
}
