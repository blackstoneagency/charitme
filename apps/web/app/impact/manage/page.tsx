import type { Metadata } from 'next';
import { requireUser } from '../../../lib/auth';
import { listOwnedCampaigns, getImpactBundle } from '../../../lib/impact';
import ManageImpact from './ManageImpact';

export const metadata: Metadata = {
  title: 'Manage Impact',
  description: 'Publish your spending plan, post verified impact updates, and track outcomes.',
};
export const dynamic = 'force-dynamic';

type PageProps = { searchParams?: Promise<{ campaign?: string }> };

export default async function ManageImpactPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const campaigns = await listOwnedCampaigns(user.id);
  const selectedId = (await searchParams)?.campaign ?? campaigns[0]?.id ?? null;
  const bundle = selectedId ? await getImpactBundle(selectedId, true) : null;

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Manage Impact</h1>
        <p style={{ color: 'var(--t3)', fontSize: 15 }}>
          Publish a spending plan, post verified updates with evidence, and track outcomes — this
          drives your public transparency score.
        </p>
      </div>
      <ManageImpact campaigns={campaigns} selectedId={selectedId} bundle={bundle} />
    </div>
  );
}
