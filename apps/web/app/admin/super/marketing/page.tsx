import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import MarketingClient, { type SeoRow, type AeoRow, type CampaignRow } from './MarketingClient';

export const dynamic = 'force-dynamic';

export default async function SuperAdminMarketingPage() {
  await requireSuperAdmin();

  const [seoRes, aeoRes, campRes] = await Promise.all([
    supabaseAdmin.from('seo_settings').select('*').order('route', { ascending: true }),
    supabaseAdmin.from('aeo_entries').select('*').order('priority', { ascending: false }).order('created_at', { ascending: false }),
    supabaseAdmin.from('marketing_campaigns').select('id, name, campaign_type, status, subject, sent_count, open_count, click_count, revenue_cents, created_at').order('created_at', { ascending: false }).limit(200),
  ]);

  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar title="Marketing" subtitle="SEO · AEO (answer engines) · Campaigns" />
      <MarketingClient
        seo={(seoRes.data ?? []) as SeoRow[]}
        aeo={(aeoRes.data ?? []) as AeoRow[]}
        campaigns={(campRes.data ?? []) as CampaignRow[]}
      />
    </CharitMeShell>
  );
}
