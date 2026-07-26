import Link from 'next/link';
import { CharitMeShell, TopBar, KFIcon } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import GrantApplicationsClient from './GrantApplicationsClient';
import GrantMatchClient from './GrantMatchClient';

export const dynamic = 'force-dynamic';

export default async function DashboardGrantsPage() {
  await requireUser();

  return (
    <CharitMeShell active="Grants">
      <TopBar
        title="Grant applications"
        subtitle="Track the grants you're applying for, from draft to decision."
        actions={
          <Link
            href="/grants"
            className="kf-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <KFIcon name="search" /> Browse grants
          </Link>
        }
      />
      <div className="kf-admin-dash" style={{ padding: '4px 0' }}>
        {/* Surfaces POST /api/ai/grant-match, which was fully built with zero callers. */}
        <GrantMatchClient />
        <GrantApplicationsClient />
      </div>
    </CharitMeShell>
  );
}
