import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { getImpactBundle, userOwnsCampaign } from '../../../../lib/impact';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ campaignId: string }> };

// GET /api/impact/:campaignId  (id or slug) — public impact bundle + transparency score.
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { campaignId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // First resolve without owner view to learn the campaign id, then re-check ownership.
  const preview = await getImpactBundle(campaignId, false);
  if (!preview) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewerOwns = !!user && (await userOwnsCampaign(preview.campaign.id, user.id));
  const bundle = viewerOwns ? await getImpactBundle(campaignId, true) : preview;

  return NextResponse.json({ impact: bundle, viewerOwns });
}
