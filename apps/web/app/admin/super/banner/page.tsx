import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { getBannerSettings, BANNER_FONT_OPTIONS, BANNER_FONT_WEIGHTS } from '../../../../lib/banner-settings';
import BannerClient from './BannerClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminBannerPage() {
  // Super-admin only — the page itself is gated in addition to the API, so the
  // surface is never reachable by a plain admin.
  await requireSuperAdmin();
  const settings = await getBannerSettings();
  return (
    <CharitMeShell active="Banner" mode="admin">
      <TopBar
        title="Banner"
        subtitle="Show, hide, and fully style the site-wide announcement bar. Changes apply everywhere the moment you save."
      />
      <BannerClient
        initial={settings}
        fonts={BANNER_FONT_OPTIONS}
        weights={[...BANNER_FONT_WEIGHTS]}
      />
    </CharitMeShell>
  );
}
