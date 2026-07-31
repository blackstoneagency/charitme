import 'server-only';
import { headers, cookies } from 'next/headers';
import {
  DEFAULT_MARKET_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  isSupportedMarketLocale,
  negotiateLocale,
  resolveMarketLocale,
  translatorFor,
  type MarketLocale,
} from './i18n';
import './locales';

/**
 * The market locale for the current request, in Server Components and Route
 * Handlers.
 *
 * Middleware has already resolved it onto a request header, so this is normally
 * a header read with no negotiation. The cookie and Accept-Language fallbacks
 * exist because middleware does NOT run everywhere — its matcher excludes `api`
 * and `_next/static`, and a statically generated page can render outside a
 * request entirely. Falling back rather than assuming the header is present is
 * what stops those paths from quietly serving everyone English.
 */
export async function getMarketLocale(): Promise<MarketLocale> {
  try {
    const h = await headers();
    const fromHeader = h.get(LOCALE_HEADER);
    if (isSupportedMarketLocale(fromHeader)) return resolveMarketLocale(fromHeader);

    const c = await cookies();
    const fromCookie = c.get(LOCALE_COOKIE)?.value;
    if (isSupportedMarketLocale(fromCookie)) return resolveMarketLocale(fromCookie);

    return resolveMarketLocale(negotiateLocale(h.get('accept-language')));
  } catch {
    // `headers()` throws outside a request scope, e.g. during static generation.
    // English is the right answer there, and is what every dictionary falls back
    // to anyway.
    return resolveMarketLocale(DEFAULT_MARKET_LOCALE);
  }
}

/** Just the BCP 47 tag, for `<html lang>` and passing to the client provider. */
export async function getLocaleTag(): Promise<string> {
  return (await getMarketLocale()).tag;
}

/** `const t = await getTranslator(); t('nav.discover')` in a Server Component. */
export async function getTranslator() {
  return translatorFor(await getLocaleTag());
}
