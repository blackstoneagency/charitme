import type { Metadata } from 'next';
import { requireUser } from '../../../lib/auth';
import { listOrganizerOpportunities } from '../../../lib/sponsorships';
import { SPONSORSHIP_CATEGORIES } from '../../../lib/sponsorships-core';
import ManageSponsorships from './ManageSponsorships';

export const metadata: Metadata = {
  title: 'Manage Sponsorship Opportunities',
  description: 'Post sponsorship opportunities and review offers from sponsors.',
};
export const dynamic = 'force-dynamic';

export default async function ManageSponsorshipsPage() {
  const user = await requireUser();
  const opportunities = await listOrganizerOpportunities(user.id);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Manage Sponsorships</h1>
        <p style={{ color: 'var(--t3)', fontSize: 15 }}>
          Post sponsorship opportunities and review offers from businesses and individuals.
        </p>
      </div>
      <ManageSponsorships initialOpportunities={opportunities} categories={[...SPONSORSHIP_CATEGORIES]} />
    </div>
  );
}
