import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicGrants, getGrantCategories } from '../../lib/grants-server';
import GrantsClient from './GrantsClient';

export const metadata: Metadata = {
  title: 'Grant Discovery — Find Funding for Your Cause',
  description:
    'Discover foundation, government, corporate, and community grants on CharitMe. Search by cause, filter by category, and apply with AI-assisted matching.',
  alternates: { canonical: 'https://www.charitme.com/grants' },
  openGraph: {
    title: 'Grant Discovery on CharitMe',
    description: 'Find and apply for grants that fund your mission — with AI matching.',
    url: 'https://www.charitme.com/grants',
    type: 'website',
  },
};

export const dynamic = 'force-dynamic';

export default async function GrantsPage() {
  // Never let a failed read 500 the page. Both are lists, so an empty result is an
  // honest "nothing to show" — unlike a statistic, where zero would be a claim.
  // Measured: this page returned 500 on a cold production build with Supabase
  // unreachable, because neither loader guarded against it.
  const [grants, categories] = await Promise.all([
    getPublicGrants(48).catch(() => []),
    getGrantCategories().catch(() => []),
  ]);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(24px, 5vw, 32px)', fontWeight: 900, margin: 0, color: 'var(--t1)' }}>
              Grant Discovery
            </h1>
            <p style={{ color: 'var(--t3)', fontSize: 15, margin: '8px 0 0', maxWidth: 640 }}>
              Foundation, government, corporate, and community grants — searchable in one place.
              Sign in to save opportunities, get AI-matched recommendations, and track applications.
            </p>
          </div>
          <Link href="/dashboard/grants">
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px',
              background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)',
              fontSize: 14, fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap',
            }}>
              My applications →
            </span>
          </Link>
        </div>
      </div>

      <GrantsClient initialGrants={grants} categories={categories} />
    </div>
  );
}
