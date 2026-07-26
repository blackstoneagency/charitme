import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../../lib/auth';
import CampaignPlansClient from './_components/CampaignPlansClient';

export const dynamic = 'force-dynamic';

export default async function CampaignPlansPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireAdmin();
  const { id } = await searchParams;
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="Campaign Plans"
        subtitle="Turn one goal into a connected multichannel campaign — landing page, email, social, SEO, and FAQ, all linked to the same goal."
        actions={<Link href="/admin/marketing/command-center" style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, background: '#f8f9fc', color: '#374151', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>← Command Center</Link>}
      />
      <CampaignPlansClient planId={id ?? null} />
    </CharitMeShell>
  );
}
