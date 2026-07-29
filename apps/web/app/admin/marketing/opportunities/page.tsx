import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../../lib/auth';
import OpportunitiesClient from './_components/OpportunitiesClient';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  await requireAdmin();
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="Opportunities"
        subtitle="Data-derived, scored opportunities from live campaign momentum. Accept one to turn it into a measurable goal."
        actions={<Link href="/admin/marketing/command-center" style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, background: 'var(--s2)', color: 'var(--t1)', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>← Command Center</Link>}
      />
      <OpportunitiesClient />
    </CharitMeShell>
  );
}
