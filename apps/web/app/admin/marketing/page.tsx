import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../lib/auth';
import AdminMarketingClient from './_components/AdminMarketingClient';
import { getMarketingOverview } from './_components/overview';

export const dynamic = 'force-dynamic';

const VALID_TABS = ['overview', 'audience', 'segments', 'campaigns', 'automations', 'copilot', 'outreach'] as const;
type TabKey = typeof VALID_TABS[number];

export default async function AdminMarketingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const overview = await getMarketingOverview();
  const { tab } = await searchParams;
  const initialTab = (VALID_TABS as readonly string[]).includes(tab ?? '') ? (tab as TabKey) : undefined;
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="Marketing"
        subtitle="Audience capture, segmentation, campaigns, automations, and the AI copilot — all on live data."
        actions={<Link href="/admin/marketing/seo" style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, background: 'linear-gradient(135deg,#7035ff,#ec39c3)', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>SEO &amp; AEO →</Link>}
      />
      <AdminMarketingClient overview={overview} initialTab={initialTab} />
    </CharitMeShell>
  );
}
