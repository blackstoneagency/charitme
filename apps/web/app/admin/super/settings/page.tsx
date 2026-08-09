import { boundedQuery } from '../../../../lib/query-timeout';
import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import SettingsClient, { type PlatformConfig } from './SettingsClient';
import { FEATURE_PRICE_DEFAULT_CENTS } from '../../../../lib/featured';
import { donationCheckoutSettingsFromPlatformConfig } from '../../../../lib/donation-checkout-settings';

export const dynamic = 'force-dynamic';

export default async function SuperAdminSettingsPage() {
  await requireSuperAdmin();
  const { data } = await boundedQuery(() => supabaseAdmin.from('platform_settings').select('config').eq('id', 1).maybeSingle());
  const raw = ((data?.config as Record<string, unknown> | null) ?? {});
  // The featured price is stored in cents under `payment`; the form works in
  // dollars. Converted here rather than in the client so the field is populated
  // on first paint instead of appearing empty until a save.
  const payment =
    raw.payment && typeof raw.payment === 'object' && !Array.isArray(raw.payment)
      ? (raw.payment as Record<string, unknown>)
      : {};
  const savedCents = Number(payment.featuredCampaignPriceCents);
  const config = {
    ...(raw as PlatformConfig),
    featuredCampaignPriceDollars:
      Number.isFinite(savedCents) && savedCents > 0 ? savedCents / 100 : FEATURE_PRICE_DEFAULT_CENTS / 100,
    donationCheckout: donationCheckoutSettingsFromPlatformConfig(raw),
  } as PlatformConfig;
  return (
    <CharitMeShell active="Platform Settings" mode="admin">
      <TopBar title="Platform Settings" subtitle="Global configuration · platform_settings" />
      <SettingsClient config={config} />
    </CharitMeShell>
  );
}
