import Link from 'next/link';
import { CharitMeShell, TopBar, KFIcon } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import VolunteerApplicationsClient from './VolunteerApplicationsClient';
import VolunteerApplicantsClient from './VolunteerApplicantsClient';

export const dynamic = 'force-dynamic';

export default async function DashboardVolunteerPage() {
  await requireUser();

  return (
    <CharitMeShell active="Volunteering">
      <TopBar
        title="Volunteering"
        subtitle="Applications you've made, and volunteers who applied to your opportunities."
        actions={
          <Link href="/volunteer" className="kf-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <KFIcon name="search" /> Find opportunities
          </Link>
        }
      />
      <div className="kf-admin-dash" style={{ padding: '4px 0', display: 'grid', gap: 28 }}>
        <section>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>Your applications</h2>
          <VolunteerApplicationsClient />
        </section>

        {/* Organizer side. Applications used to arrive with nowhere to read them —
            the accept/decline endpoint existed but had no caller anywhere in the UI.
            The component renders nothing noisy when you host no opportunities. */}
        <section>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 12px' }}>Applicants to your opportunities</h2>
          <VolunteerApplicantsClient />
        </section>
      </div>
    </CharitMeShell>
  );
}
