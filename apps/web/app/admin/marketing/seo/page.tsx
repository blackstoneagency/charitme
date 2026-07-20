import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import SeoAeoClient, { type SeoRow, type AeoRow } from './_components/SeoAeoClient';

export const dynamic = 'force-dynamic';

export default async function AdminSeoAeoPage() {
  await requireAdmin();

  const [{ data: seo }, { data: aeo }] = await Promise.all([
    supabaseAdmin.from('seo_settings').select('*').order('route'),
    supabaseAdmin.from('aeo_entries').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }),
  ]);

  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="SEO & AEO"
        subtitle="Per-route search metadata and answer-engine (AI search) Q&A — wired to Supabase."
        actions={<></>}
      />
      <SeoAeoClient initialSeo={(seo ?? []) as SeoRow[]} initialAeo={(aeo ?? []) as AeoRow[]} />
    </CharitMeShell>
  );
}
