import type { Metadata } from 'next';
import { BtnLink, EmptyState } from '../components/ui';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="container" style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px' }}>
      <EmptyState
        icon="🔍"
        title="404 — Page not found"
        body="The page you're looking for doesn't exist, may have been moved, or the campaign may have ended. Let's get you back on track."
        action={
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <BtnLink href="/" variant="primary">Back to home</BtnLink>
            <BtnLink href="/campaigns" variant="secondary">Browse campaigns</BtnLink>
          </div>
        }
      />
    </div>
  );
}
