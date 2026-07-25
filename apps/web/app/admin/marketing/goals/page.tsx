import 'server-only';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireAdmin } from '../../../../lib/auth';
import GoalsClient from './_components/GoalsClient';

export const dynamic = 'force-dynamic';

export default async function MarketingGoalsPage() {
  await requireAdmin();
  return (
    <CharitMeShell active="Marketing" mode="admin">
      <TopBar
        title="Marketing Goals"
        subtitle="Tell CharitMe the outcome you want. Enter a business objective in plain English — the OS turns it into a measurable goal tracked against live data."
        actions={<Link href="/admin/marketing" style={{ height: 38, display: 'inline-flex', alignItems: 'center', padding: '0 16px', borderRadius: 10, background: '#f8f9fc', color: '#374151', border: '1px solid #e2e8f0', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>← Marketing</Link>}
      />
      <GoalsClient />
    </CharitMeShell>
  );
}
