import 'server-only';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { INDEXABLE_PUBLIC_ROUTES } from '../../../lib/public-routes';
import { countStaleSeoContent } from '../../../lib/seo-audit';
import AdminMarketingClient from './_components/AdminMarketingClient';
import { getMarketingOverview } from './_components/overview';
import type { SeoRow, AeoRow } from './seo/_components/SeoAeoClient';

export const dynamic = 'force-dynamic';

// Single Marketing surface. `/admin/super/marketing` used to be a second, parallel
// page over the SAME tables (seo_settings / aeo_entries / marketing_campaigns);
// it now redirects here and SEO + AEO are first-class tabs, so there is exactly
// one place to manage marketing.
const VALID_TABS = ['overview', 'audience', 'segments', 'campaigns', 'automations', 'copilot', 'outreach', 'seo', 'aeo'] as const;
type TabKey = typeof VALID_TABS[number];

export default async function AdminMarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const [overview, { data: seo }, { data: aeo }] = await Promise.all([
    getMarketingOverview(),
    supabaseAdmin.from('seo_settings').select('*').order('route'),
    supabaseAdmin.from('aeo_entries').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }),
  ]);

  const seoRows = (seo ?? []) as SeoRow[];
  const aeoRows = (aeo ?? []) as AeoRow[];
  const publicRoutes = INDEXABLE_PUBLIC_ROUTES.map((route) => route.path);
  const publicRouteSet = new Set(publicRoutes);
  const configuredSeoRoutes = new Set(seoRows.filter((row) => !row.noindex && publicRouteSet.has(row.route)).map((row) => row.route));
  const coveredAeoRoutes = new Set(aeoRows.filter((row) => row.published && row.schema_type !== 'HowTo' && publicRouteSet.has(row.route)).map((row) => row.route));
  const coverage = {
    publicRoutes: publicRoutes.length,
    seoConfigured: configuredSeoRoutes.size,
    aeoCovered: coveredAeoRoutes.size,
    staleSeo: countStaleSeoContent(seoRows),
    staleAeo: countStaleSeoContent(aeoRows),
    missingAeoRoutes: publicRoutes.filter((route) => !coveredAeoRoutes.has(route)).slice(0, 12),
  };

  const { tab } = await searchParams;
  const initialTab = (VALID_TABS as readonly string[]).includes(tab ?? '') ? (tab as TabKey) : undefined;
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="Marketing"
        subtitle="Audience, segments, campaigns, automations, AI copilot, outreach, SEO and AEO — all on live data."
      />
      <AdminMarketingClient
        overview={overview}
        initialTab={initialTab}
        seo={seoRows}
        aeo={aeoRows}
        seoCoverage={coverage}
      />
    </CharitMeShell>
  );
}
