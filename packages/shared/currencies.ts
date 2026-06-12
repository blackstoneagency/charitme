// ─────────────────────────────────────────────────────────────────────────────
// Multi-currency support — shared between web app and API routes.
//
// All supported currencies are two-decimal (100 minor units = 1 major unit),
// so `amount_cents` semantics hold unchanged across the entire pipeline
// (DB → Stripe `unit_amount` → display). Zero-decimal currencies (JPY, KRW)
// are intentionally excluded until amounts are migrated to minor-unit-agnostic
// storage. Every code below is supported by Stripe for payments.
// ─────────────────────────────────────────────────────────────────────────────

export interface CurrencyInfo {
  code: string;   // ISO 4217, uppercase
  name: string;
  symbol: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar',            symbol: '$' },
  { code: 'EUR', name: 'Euro',                 symbol: '€' },
  { code: 'GBP', name: 'British Pound',        symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar',      symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar',    symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar',   symbol: 'NZ$' },
  { code: 'CHF', name: 'Swiss Franc',          symbol: 'CHF' },
  { code: 'SEK', name: 'Swedish Krona',        symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone',      symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone',         symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty',         symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna',         symbol: 'Kč' },
  { code: 'RON', name: 'Romanian Leu',         symbol: 'lei' },
  { code: 'SGD', name: 'Singapore Dollar',     symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar',     symbol: 'HK$' },
  { code: 'MXN', name: 'Mexican Peso',         symbol: 'MX$' },
  { code: 'BRL', name: 'Brazilian Real',       symbol: 'R$' },
  { code: 'INR', name: 'Indian Rupee',         symbol: '₹' },
  { code: 'AED', name: 'UAE Dirham',           symbol: 'د.إ' },
  { code: 'ZAR', name: 'South African Rand',   symbol: 'R' },
  { code: 'ILS', name: 'Israeli New Shekel',   symbol: '₪' },
  { code: 'PHP', name: 'Philippine Peso',      symbol: '₱' },
  { code: 'MYR', name: 'Malaysian Ringgit',    symbol: 'RM' },
  { code: 'THB', name: 'Thai Baht',            symbol: '฿' },
];

export const DEFAULT_CURRENCY = 'USD';

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map(c => c.code);

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCY_CODES.includes(code.toUpperCase());
}

/** Uppercase + validate; unknown codes fall back to USD so display never breaks. */
export function normalizeCurrency(code: string | null | undefined): string {
  const up = (code ?? '').toUpperCase();
  return isSupportedCurrency(up) ? up : DEFAULT_CURRENCY;
}

export function currencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find(c => c.code === code.toUpperCase())?.symbol ?? '$';
}

/** "$1,234.56" / "€1.234,56" — full currency format from minor units. */
export function formatMoney(cents: number, currency: string = DEFAULT_CURRENCY, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: normalizeCurrency(currency) }).format(cents / 100);
}

/** "$1,234" when whole, full format otherwise — for compact displays. */
export function formatMoneyShort(cents: number, currency: string = DEFAULT_CURRENCY, locale: string = 'en-US'): string {
  if (cents % 100 === 0) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizeCurrency(currency),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }
  return formatMoney(cents, currency, locale);
}

/** "$1.2M" for large amounts, otherwise "$1,234" — for hero stats and story cards. */
export function formatMoneyCompact(cents: number, currency: string = DEFAULT_CURRENCY, locale: string = 'en-US'): string {
  const amount = cents / 100;
  if (amount >= 1_000_000) {
    return `${currencySymbol(currency)}${(amount / 1_000_000).toFixed(1)}M`;
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalizeCurrency(currency),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
