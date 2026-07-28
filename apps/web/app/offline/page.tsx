import { BtnLink } from '../../components/ui';

export const metadata = { title: "You're offline" };

// Standalone page (served by the service worker when the network is unreachable),
// so it owns its own heading structure. It previously used <EmptyState>, whose
// title renders as an <h3> — that left the page with no <h1> at all, and adding a
// hidden <h1> above it just turned the problem into an h1→h3 level skip. Written
// out here instead so the visible title *is* the h1.
export default function OfflinePage() {
  return (
    <div className="container" style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px' }}>
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--t3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }} aria-hidden="true">📡</div>
        <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--t2)', marginBottom: '8px' }}>
          You&apos;re offline
        </h1>
        <p style={{ fontSize: '14px', marginBottom: '20px' }}>
          CharitMe couldn&apos;t reach the network. Check your connection and try again — pages
          you&apos;ve already visited may still be available.
        </p>
        <BtnLink href="/" variant="primary">Back to home</BtnLink>
      </div>
    </div>
  );
}
