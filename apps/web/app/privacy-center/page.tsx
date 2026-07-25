import type { Metadata } from 'next';
import { requireUser } from '../../lib/auth';
import { listUserRequests } from '../../lib/privacy';
import PrivacyCenter from './PrivacyCenter';

export const metadata: Metadata = {
  title: 'Privacy Center — Your Data',
  description: 'Download a copy of your CharitMe data or request account deletion.',
  // Personalized, auth-gated page — keep it out of search indexes.
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function PrivacyCenterPage() {
  const user = await requireUser();
  const requests = await listUserRequests(user.id);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>🔒 Privacy Center</h1>
        <p style={{ color: 'var(--t3)', fontSize: 15 }}>
          Exercise your data rights. Download everything CharitMe holds about you, or request that
          your account be deleted.
        </p>
      </div>
      <PrivacyCenter initialRequests={requests} />
    </div>
  );
}
