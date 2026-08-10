import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import CheckInClient from './CheckInClient';

export const dynamic = 'force-dynamic';

export default async function EventCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requireUser();
  const { code = '' } = await searchParams;
  return (
    <CharitMeShell active="Events">
      <TopBar title="Event Check-in" subtitle="Scan or enter an attendee ticket code." />
      <section className="kf-card" style={{ padding: 20, maxWidth: 560 }}>
        <CheckInClient initialCode={code} />
        <Link href="/events/manage" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', marginTop: 16, color: 'var(--t2)' }}>
          Back to event management
        </Link>
      </section>
    </CharitMeShell>
  );
}
