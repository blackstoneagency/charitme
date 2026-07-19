import type { Metadata } from 'next';
import { requireUser } from '../../../lib/auth';
import { listSponsorPrograms } from '../../../lib/matching';
import ManageMatching from './ManageMatching';

export const metadata: Metadata = {
  title: 'Manage Matching Programs',
  description: 'Launch corporate matching-gift programs and review employee match claims.',
};
export const dynamic = 'force-dynamic';

export default async function ManageMatchingPage() {
  const user = await requireUser();
  const programs = await listSponsorPrograms(user.id);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 880 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Manage Matching Programs</h1>
        <p style={{ color: 'var(--t3)', fontSize: 15 }}>
          Launch a corporate matching-gift program and review employee match claims.
        </p>
      </div>
      <ManageMatching initialPrograms={programs} />
    </div>
  );
}
