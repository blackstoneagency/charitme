-- =============================================================================
-- Seed supported_countries (fixes an empty PUBLIC page)
-- =============================================================================
-- /supported-countries is a public page fully wired to this table, but the table
-- was only ever populated by a lazy maybeSeed() that runs when an admin happens
-- to open /admin/countries. Since no admin had, production was live showing
-- "supports fundraisers in 0 countries and accepts donations from 0 countries"
-- with both country grids empty.
--
-- This seeds the canonical list (69 countries: 20 can fundraise,
-- 49 donate-only) so the page is correct regardless of admin activity.
-- Idempotent: ON CONFLICT on iso_code does nothing, and admins can still edit
-- rows afterwards via /admin/countries without this re-overwriting them.
-- =============================================================================

create unique index if not exists supported_countries_iso_code_key
  on public.supported_countries (iso_code);

insert into public.supported_countries
  (name, flag_emoji, iso_code, currency_code, can_fundraise, can_donate, sort_order, active)
values
  ('United States', '🇺🇸', 'US', 'USD', true, true, 1, true),
  ('United Kingdom', '🇬🇧', 'GB', 'GBP', true, true, 2, true),
  ('Canada', '🇨🇦', 'CA', 'CAD', true, true, 3, true),
  ('Australia', '🇦🇺', 'AU', 'AUD', true, true, 4, true),
  ('Austria', '🇦🇹', 'AT', 'EUR', true, true, 5, true),
  ('Belgium', '🇧🇪', 'BE', 'EUR', true, true, 6, true),
  ('Denmark', '🇩🇰', 'DK', 'DKK', true, true, 7, true),
  ('Finland', '🇫🇮', 'FI', 'EUR', true, true, 8, true),
  ('France', '🇫🇷', 'FR', 'EUR', true, true, 9, true),
  ('Germany', '🇩🇪', 'DE', 'EUR', true, true, 10, true),
  ('Ireland', '🇮🇪', 'IE', 'EUR', true, true, 11, true),
  ('Italy', '🇮🇹', 'IT', 'EUR', true, true, 12, true),
  ('Luxembourg', '🇱🇺', 'LU', 'EUR', true, true, 13, true),
  ('Netherlands', '🇳🇱', 'NL', 'EUR', true, true, 14, true),
  ('New Zealand', '🇳🇿', 'NZ', 'NZD', true, true, 15, true),
  ('Norway', '🇳🇴', 'NO', 'NOK', true, true, 16, true),
  ('Portugal', '🇵🇹', 'PT', 'EUR', true, true, 17, true),
  ('Spain', '🇪🇸', 'ES', 'EUR', true, true, 18, true),
  ('Sweden', '🇸🇪', 'SE', 'SEK', true, true, 19, true),
  ('Switzerland', '🇨🇭', 'CH', 'CHF', true, true, 20, true),
  ('Argentina', '🇦🇷', 'AR', 'ARS', false, true, 100, true),
  ('Bahrain', '🇧🇭', 'BH', 'BHD', false, true, 101, true),
  ('Brazil', '🇧🇷', 'BR', 'BRL', false, true, 102, true),
  ('Chile', '🇨🇱', 'CL', 'CLP', false, true, 103, true),
  ('China', '🇨🇳', 'CN', 'CNY', false, true, 104, true),
  ('Colombia', '🇨🇴', 'CO', 'COP', false, true, 105, true),
  ('Costa Rica', '🇨🇷', 'CR', 'CRC', false, true, 106, true),
  ('Croatia', '🇭🇷', 'HR', 'EUR', false, true, 107, true),
  ('Cyprus', '🇨🇾', 'CY', 'EUR', false, true, 108, true),
  ('Czech Republic', '🇨🇿', 'CZ', 'CZK', false, true, 109, true),
  ('Egypt', '🇪🇬', 'EG', 'EGP', false, true, 110, true),
  ('Estonia', '🇪🇪', 'EE', 'EUR', false, true, 111, true),
  ('Greece', '🇬🇷', 'GR', 'EUR', false, true, 112, true),
  ('Hong Kong', '🇭🇰', 'HK', 'HKD', false, true, 113, true),
  ('Hungary', '🇭🇺', 'HU', 'HUF', false, true, 114, true),
  ('India', '🇮🇳', 'IN', 'INR', false, true, 115, true),
  ('Indonesia', '🇮🇩', 'ID', 'IDR', false, true, 116, true),
  ('Israel', '🇮🇱', 'IL', 'ILS', false, true, 117, true),
  ('Japan', '🇯🇵', 'JP', 'JPY', false, true, 118, true),
  ('Jordan', '🇯🇴', 'JO', 'JOD', false, true, 119, true),
  ('Kenya', '🇰🇪', 'KE', 'KES', false, true, 120, true),
  ('Kuwait', '🇰🇼', 'KW', 'KWD', false, true, 121, true),
  ('Latvia', '🇱🇻', 'LV', 'EUR', false, true, 122, true),
  ('Lebanon', '🇱🇧', 'LB', 'USD', false, true, 123, true),
  ('Lithuania', '🇱🇹', 'LT', 'EUR', false, true, 124, true),
  ('Malaysia', '🇲🇾', 'MY', 'MYR', false, true, 125, true),
  ('Mexico', '🇲🇽', 'MX', 'MXN', false, true, 126, true),
  ('Morocco', '🇲🇦', 'MA', 'MAD', false, true, 127, true),
  ('Namibia', '🇳🇦', 'NA', 'NAD', false, true, 128, true),
  ('Nigeria', '🇳🇬', 'NG', 'NGN', false, true, 129, true),
  ('Oman', '🇴🇲', 'OM', 'OMR', false, true, 130, true),
  ('Pakistan', '🇵🇰', 'PK', 'PKR', false, true, 131, true),
  ('Peru', '🇵🇪', 'PE', 'PEN', false, true, 132, true),
  ('Philippines', '🇵🇭', 'PH', 'PHP', false, true, 133, true),
  ('Poland', '🇵🇱', 'PL', 'PLN', false, true, 134, true),
  ('Qatar', '🇶🇦', 'QA', 'QAR', false, true, 135, true),
  ('Romania', '🇷🇴', 'RO', 'RON', false, true, 136, true),
  ('Saudi Arabia', '🇸🇦', 'SA', 'SAR', false, true, 137, true),
  ('Singapore', '🇸🇬', 'SG', 'SGD', false, true, 138, true),
  ('Slovakia', '🇸🇰', 'SK', 'EUR', false, true, 139, true),
  ('Slovenia', '🇸🇮', 'SI', 'EUR', false, true, 140, true),
  ('South Africa', '🇿🇦', 'ZA', 'ZAR', false, true, 141, true),
  ('South Korea', '🇰🇷', 'KR', 'KRW', false, true, 142, true),
  ('Taiwan', '🇹🇼', 'TW', 'TWD', false, true, 143, true),
  ('Thailand', '🇹🇭', 'TH', 'THB', false, true, 144, true),
  ('Turkey', '🇹🇷', 'TR', 'TRY', false, true, 145, true),
  ('United Arab Emirates', '🇦🇪', 'AE', 'AED', false, true, 146, true),
  ('Vietnam', '🇻🇳', 'VN', 'VND', false, true, 147, true),
  ('Zambia', '🇿🇲', 'ZM', 'ZMW', false, true, 148, true)
on conflict (iso_code) do nothing;
