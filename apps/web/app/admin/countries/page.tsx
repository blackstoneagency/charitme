import { boundedQuery } from '../../../lib/query-timeout';
import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import AdminCountriesClient from './_components/AdminCountriesClient';

export const dynamic = 'force-dynamic';

// ── Seed all countries on first visit (idempotent) ────────────────────────────
async function maybeSeed() {
  const { count, error } = await boundedQuery(() => supabaseAdmin
    .from('supported_countries')
    .select('id', { count: 'exact', head: true }));
  // ⚠️ A FAILED read is not an empty table, and this branch performs a WRITE.
  // `(count ?? 0) > 0` treated an unreadable count as zero and fell through to
  // seeding, which would try to insert the entire country list over a table that
  // may already be populated. Only seed when the count was genuinely measured
  // and is genuinely 0 — anything else returns and leaves the data alone.
  if (error || typeof count !== 'number') return;
  if (count > 0) return;

  const fundraisers = [
    { name: 'United States',   flag_emoji: '🇺🇸', iso_code: 'US', currency_code: 'USD', can_fundraise: true, can_donate: true, sort_order: 1 },
    { name: 'United Kingdom',  flag_emoji: '🇬🇧', iso_code: 'GB', currency_code: 'GBP', can_fundraise: true, can_donate: true, sort_order: 2 },
    { name: 'Canada',          flag_emoji: '🇨🇦', iso_code: 'CA', currency_code: 'CAD', can_fundraise: true, can_donate: true, sort_order: 3 },
    { name: 'Australia',       flag_emoji: '🇦🇺', iso_code: 'AU', currency_code: 'AUD', can_fundraise: true, can_donate: true, sort_order: 4 },
    { name: 'Austria',         flag_emoji: '🇦🇹', iso_code: 'AT', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 5 },
    { name: 'Belgium',         flag_emoji: '🇧🇪', iso_code: 'BE', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 6 },
    { name: 'Denmark',         flag_emoji: '🇩🇰', iso_code: 'DK', currency_code: 'DKK', can_fundraise: true, can_donate: true, sort_order: 7 },
    { name: 'Finland',         flag_emoji: '🇫🇮', iso_code: 'FI', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 8 },
    { name: 'France',          flag_emoji: '🇫🇷', iso_code: 'FR', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 9 },
    { name: 'Germany',         flag_emoji: '🇩🇪', iso_code: 'DE', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 10 },
    { name: 'Ireland',         flag_emoji: '🇮🇪', iso_code: 'IE', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 11 },
    { name: 'Italy',           flag_emoji: '🇮🇹', iso_code: 'IT', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 12 },
    { name: 'Luxembourg',      flag_emoji: '🇱🇺', iso_code: 'LU', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 13 },
    { name: 'Netherlands',     flag_emoji: '🇳🇱', iso_code: 'NL', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 14 },
    { name: 'New Zealand',     flag_emoji: '🇳🇿', iso_code: 'NZ', currency_code: 'NZD', can_fundraise: true, can_donate: true, sort_order: 15 },
    { name: 'Norway',          flag_emoji: '🇳🇴', iso_code: 'NO', currency_code: 'NOK', can_fundraise: true, can_donate: true, sort_order: 16 },
    { name: 'Portugal',        flag_emoji: '🇵🇹', iso_code: 'PT', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 17 },
    { name: 'Spain',           flag_emoji: '🇪🇸', iso_code: 'ES', currency_code: 'EUR', can_fundraise: true, can_donate: true, sort_order: 18 },
    { name: 'Sweden',          flag_emoji: '🇸🇪', iso_code: 'SE', currency_code: 'SEK', can_fundraise: true, can_donate: true, sort_order: 19 },
    { name: 'Switzerland',     flag_emoji: '🇨🇭', iso_code: 'CH', currency_code: 'CHF', can_fundraise: true, can_donate: true, sort_order: 20 },
  ];

  const donorsOnly = [
    { name: 'Argentina',             flag_emoji: '🇦🇷', iso_code: 'AR', currency_code: 'ARS' },
    { name: 'Bahrain',               flag_emoji: '🇧🇭', iso_code: 'BH', currency_code: 'BHD' },
    { name: 'Brazil',                flag_emoji: '🇧🇷', iso_code: 'BR', currency_code: 'BRL' },
    { name: 'Chile',                 flag_emoji: '🇨🇱', iso_code: 'CL', currency_code: 'CLP' },
    { name: 'China',                 flag_emoji: '🇨🇳', iso_code: 'CN', currency_code: 'CNY' },
    { name: 'Colombia',              flag_emoji: '🇨🇴', iso_code: 'CO', currency_code: 'COP' },
    { name: 'Costa Rica',            flag_emoji: '🇨🇷', iso_code: 'CR', currency_code: 'CRC' },
    { name: 'Croatia',               flag_emoji: '🇭🇷', iso_code: 'HR', currency_code: 'EUR' },
    { name: 'Cyprus',                flag_emoji: '🇨🇾', iso_code: 'CY', currency_code: 'EUR' },
    { name: 'Czech Republic',        flag_emoji: '🇨🇿', iso_code: 'CZ', currency_code: 'CZK' },
    { name: 'Egypt',                 flag_emoji: '🇪🇬', iso_code: 'EG', currency_code: 'EGP' },
    { name: 'Estonia',               flag_emoji: '🇪🇪', iso_code: 'EE', currency_code: 'EUR' },
    { name: 'Greece',                flag_emoji: '🇬🇷', iso_code: 'GR', currency_code: 'EUR' },
    { name: 'Hong Kong',             flag_emoji: '🇭🇰', iso_code: 'HK', currency_code: 'HKD' },
    { name: 'Hungary',               flag_emoji: '🇭🇺', iso_code: 'HU', currency_code: 'HUF' },
    { name: 'India',                 flag_emoji: '🇮🇳', iso_code: 'IN', currency_code: 'INR' },
    { name: 'Indonesia',             flag_emoji: '🇮🇩', iso_code: 'ID', currency_code: 'IDR' },
    { name: 'Israel',                flag_emoji: '🇮🇱', iso_code: 'IL', currency_code: 'ILS' },
    { name: 'Japan',                 flag_emoji: '🇯🇵', iso_code: 'JP', currency_code: 'JPY' },
    { name: 'Jordan',                flag_emoji: '🇯🇴', iso_code: 'JO', currency_code: 'JOD' },
    { name: 'Kenya',                 flag_emoji: '🇰🇪', iso_code: 'KE', currency_code: 'KES' },
    { name: 'Kuwait',                flag_emoji: '🇰🇼', iso_code: 'KW', currency_code: 'KWD' },
    { name: 'Latvia',                flag_emoji: '🇱🇻', iso_code: 'LV', currency_code: 'EUR' },
    { name: 'Lebanon',               flag_emoji: '🇱🇧', iso_code: 'LB', currency_code: 'USD' },
    { name: 'Lithuania',             flag_emoji: '🇱🇹', iso_code: 'LT', currency_code: 'EUR' },
    { name: 'Malaysia',              flag_emoji: '🇲🇾', iso_code: 'MY', currency_code: 'MYR' },
    { name: 'Mexico',                flag_emoji: '🇲🇽', iso_code: 'MX', currency_code: 'MXN' },
    { name: 'Morocco',               flag_emoji: '🇲🇦', iso_code: 'MA', currency_code: 'MAD' },
    { name: 'Namibia',               flag_emoji: '🇳🇦', iso_code: 'NA', currency_code: 'NAD' },
    { name: 'Nigeria',               flag_emoji: '🇳🇬', iso_code: 'NG', currency_code: 'NGN' },
    { name: 'Oman',                  flag_emoji: '🇴🇲', iso_code: 'OM', currency_code: 'OMR' },
    { name: 'Pakistan',              flag_emoji: '🇵🇰', iso_code: 'PK', currency_code: 'PKR' },
    { name: 'Peru',                  flag_emoji: '🇵🇪', iso_code: 'PE', currency_code: 'PEN' },
    { name: 'Philippines',           flag_emoji: '🇵🇭', iso_code: 'PH', currency_code: 'PHP' },
    { name: 'Poland',                flag_emoji: '🇵🇱', iso_code: 'PL', currency_code: 'PLN' },
    { name: 'Qatar',                 flag_emoji: '🇶🇦', iso_code: 'QA', currency_code: 'QAR' },
    { name: 'Romania',               flag_emoji: '🇷🇴', iso_code: 'RO', currency_code: 'RON' },
    { name: 'Saudi Arabia',          flag_emoji: '🇸🇦', iso_code: 'SA', currency_code: 'SAR' },
    { name: 'Singapore',             flag_emoji: '🇸🇬', iso_code: 'SG', currency_code: 'SGD' },
    { name: 'Slovakia',              flag_emoji: '🇸🇰', iso_code: 'SK', currency_code: 'EUR' },
    { name: 'Slovenia',              flag_emoji: '🇸🇮', iso_code: 'SI', currency_code: 'EUR' },
    { name: 'South Africa',          flag_emoji: '🇿🇦', iso_code: 'ZA', currency_code: 'ZAR' },
    { name: 'South Korea',           flag_emoji: '🇰🇷', iso_code: 'KR', currency_code: 'KRW' },
    { name: 'Taiwan',                flag_emoji: '🇹🇼', iso_code: 'TW', currency_code: 'TWD' },
    { name: 'Thailand',              flag_emoji: '🇹🇭', iso_code: 'TH', currency_code: 'THB' },
    { name: 'Turkey',                flag_emoji: '🇹🇷', iso_code: 'TR', currency_code: 'TRY' },
    { name: 'United Arab Emirates',  flag_emoji: '🇦🇪', iso_code: 'AE', currency_code: 'AED' },
    { name: 'Vietnam',               flag_emoji: '🇻🇳', iso_code: 'VN', currency_code: 'VND' },
    { name: 'Zambia',                flag_emoji: '🇿🇲', iso_code: 'ZM', currency_code: 'ZMW' },
  ].map((c, i) => ({ ...c, can_fundraise: false, can_donate: true, sort_order: 100 + i }));

  const rows = [
    ...fundraisers,
    ...donorsOnly,
  ].map(r => ({ ...r, active: true, notes: null }));

  // Insert in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    await supabaseAdmin.from('supported_countries').insert(rows.slice(i, i + 50));
  }
}

export default async function AdminCountriesPage() {
  await requireAdmin();
  await maybeSeed();

  // `count` is null when the query FAILS, not when the table is empty, so a
  // `?? 0` fallback rendered "0 countries — 0 can fundraise" as though it were a
  // measurement. Convention already set in dashboard/settings: "null when the
  // count could not be read — render unknown, never 0."
  const { count: total }     = await boundedQuery(() => supabaseAdmin.from('supported_countries').select('id', { count: 'exact', head: true }));
  const { count: fundraise } = await boundedQuery(() => supabaseAdmin.from('supported_countries').select('id', { count: 'exact', head: true }).eq('can_fundraise', true));

  return (
    <CharitMeShell active="Supported Countries" mode="admin">
      <TopBar
        title="Supported Countries"
        subtitle={`${total ?? '—'} countries — ${fundraise ?? '—'} can fundraise. Changes appear live on /supported-countries.`}
        actions={<></>}
      />
      <AdminCountriesClient />
    </CharitMeShell>
  );
}
