import type { Metadata } from 'next';
import { requireUser } from '../../../lib/auth';
import AiCampaignFlow from './AiCampaignFlow';

export const metadata: Metadata = {
  title: 'Create a Campaign with AI',
  description: 'Build a complete fundraising campaign in twelve guided steps.',
  alternates: { canonical: 'https://www.charitme.com/create/ai' },
};

export const dynamic = 'force-dynamic';

/**
 * Auth-gated, like `/create`.
 *
 * `requireUser()` rather than a client-side check: step 8 creates a campaign
 * owned by the signed-in user, and every AI endpoint the flow calls is itself
 * authenticated. Letting someone walk eight steps before discovering they need
 * an account would throw the work away at the worst moment.
 *
 * `middleware.ts` already redirects unauthenticated users away from `/create`;
 * this route sits under it, so the same rule applies.
 */
export default async function CreateWithAiPage({
  searchParams,
}: {
  searchParams: Promise<{ cause?: string; ai?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  // `/ai-campaign` sends the visitor's typed prompt here, so the flow starts
  // with what they already said rather than asking again.
  const initialCause = (params.cause ?? params.ai ?? '').slice(0, 500);

  return (
    <div className="container" style={{ padding: '32px 0 72px' }}>
      <AiCampaignFlow initialCause={initialCause} />
    </div>
  );
}
