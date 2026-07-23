import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { INDEXABLE_PUBLIC_ROUTES } from '../../../../lib/public-routes';
import { countStaleSeoContent } from '../../../../lib/seo-audit';
import SeoAeoClient, { type SeoRow, type AeoRow } from './_components/SeoAeoClient';

export const dynamic = 'force-dynamic';

export default async function AdminSeoAeoPage() {
  await requireAdmin();

  const [{ data: seo }, { data: aeo }] = await Promise.all([
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

  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="SEO & AEO"
        subtitle="Per-route search metadata and answer-engine (AI search) Q&A — wired to Supabase."
        actions={<></>}
      />
      <SeoAeoClient initialSeo={seoRows} initialAeo={aeoRows} coverage={coverage} />
    </CharitMeShell>
  );
}
