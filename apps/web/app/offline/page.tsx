import Link from 'next/link';
import { EmptyState, Btn } from '../../components/ui';

export const metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container" style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px' }}>
      <EmptyState
        icon="📡"
        title="You're offline"
        body="CharitMe couldn't reach the network. Check your connection and try again — pages you've already visited may still be available."
        action={
          <Link href="/">
            <Btn variant="primary">Back to home</Btn>
          </Link>
        }
      />
    </div>
  );
}
