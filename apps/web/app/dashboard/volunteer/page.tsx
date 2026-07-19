import Link from 'next/link';
import { CharitMeShell, TopBar, KFIcon } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import VolunteerApplicationsClient from './VolunteerApplicationsClient';

export const dynamic = 'force-dynamic';

export default async function DashboardVolunteerPage() {
  await requireUser();

  return (
    <CharitMeShell active="Volunteering">
      <TopBar
        title="Volunteering"
        subtitle="Track the opportunities you've applied to and your logged hours."
        actions={
          <Link href="/volunteer" className="kf-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <KFIcon name="search" /> Find opportunities
          </Link>
        }
      />
      <div className="kf-admin-dash" style={{ padding: '4px 0' }}>
        <VolunteerApplicationsClient />
      </div>
    </CharitMeShell>
  );
}
