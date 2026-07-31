import type { Metadata } from 'next';
import Link from 'next/link';
import NearbyClient from './NearbyClient';

export const metadata: Metadata = {
  title: 'Fundraisers Near You | CharitMe',
  description:
    'Find active fundraisers close to you. Search by distance and support causes in your own community.',
  alternates: { canonical: 'https://www.charitme.com/nearby' },
};

export default function NearbyPage() {
  return (
    <main id="main-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 64px' }}>
      <header style={{ marginBottom: 24 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--violet-ink)',
            marginBottom: 10,
          }}
        >
          Near you
        </span>
        <h1 style={{ fontSize: 36, lineHeight: 1.15, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          Fundraisers in your community
        </h1>
        <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: 0, maxWidth: 640 }}>
          Causes close enough to see the difference. Choose a distance and search — or{' '}
          <Link href="/campaigns" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
            browse every fundraiser
          </Link>
          .
        </p>
      </header>

      <NearbyClient />
    </main>
  );
}
