import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimitDurable } from '../../../../../lib/rate-limit-durable';
import {
  ARCHIVE_DEMO_CONFIRMATION,
  isApprovedDemoSeedSlug,
  LABEL_DEMO_CONFIRMATION,
} from '../../../../../lib/demo-data-core';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';
import { supabaseAdmin } from '../../../../../lib/supabase';

const CampaignIds = z.array(z.string().uuid()).min(1).max(100);
const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('label'),
    campaignIds: CampaignIds,
    confirmation: z.literal(LABEL_DEMO_CONFIRMATION),
  }),
  z.object({
    action: z.literal('archive'),
    campaignIds: CampaignIds,
    confirmation: z.literal(ARCHIVE_DEMO_CONFIRMATION),
  }),
]);

type CampaignRow = { id: string; slug: string; is_demo: boolean };

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  if (!(await checkRateLimitDurable(`super-admin-demo-data:${guard.user.id}`, 12, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const uniqueIds = [...new Set(parsed.data.campaignIds)];
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id,slug,is_demo')
    .in('id', uniqueIds);

  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  const campaigns = (data ?? []) as CampaignRow[];
  if (campaigns.length !== uniqueIds.length) {
    return NextResponse.json({ error: 'One or more campaigns were not found', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 });
  }

  if (parsed.data.action === 'label' && campaigns.some((row) => !isApprovedDemoSeedSlug(row.slug))) {
    return NextResponse.json(
      { error: 'Only known seed-pattern campaigns can be labeled here', code: 'UNAPPROVED_DEMO_PATTERN' },
      { status: 409 },
    );
  }
  if (parsed.data.action === 'archive' && campaigns.some((row) => !row.is_demo)) {
    return NextResponse.json(
      { error: 'Every campaign must be labeled as demo before it can be archived', code: 'DEMO_LABEL_REQUIRED' },
      { status: 409 },
    );
  }

  const { count: paidDonationCount, error: paymentLookupError } = await supabaseAdmin
    .from('donations')
    .select('id', { count: 'exact', head: true })
    .in('campaign_id', uniqueIds)
    .or('stripe_payment_intent_id.not.is.null,stripe_checkout_session_id.not.is.null');

  if (paymentLookupError) {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
  if ((paidDonationCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Campaigns linked to Stripe payments cannot be changed by demo cleanup', code: 'REAL_PAYMENT_LINKED' },
      { status: 409 },
    );
  }

  if (parsed.data.action === 'label') {
    const { error: labelError } = await supabaseAdmin
      .from('campaigns')
      .update({ is_demo: true })
      .in('id', uniqueIds);
    if (labelError) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

    const { error: donationLabelError } = await supabaseAdmin
      .from('donations')
      .update({ is_demo: true })
      .in('campaign_id', uniqueIds);
    if (donationLabelError) {
      return NextResponse.json({ error: 'Demo campaigns were labeled but related donations need review', code: 'PARTIAL_UPDATE' }, { status: 500 });
    }
  } else {
    const { error: archiveError } = await supabaseAdmin
      .from('campaigns')
      .update({ accept_donations: false, deleted_at: new Date().toISOString(), status: 'paused' })
      .eq('is_demo', true)
      .in('id', uniqueIds);
    if (archiveError) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  await logSuperAdminAction(
    guard.user.id,
    `demo_data.${parsed.data.action}`,
    'campaigns',
    null,
    { campaign_ids: uniqueIds, count: uniqueIds.length },
  );

  return NextResponse.json({ ok: true, action: parsed.data.action, updated: uniqueIds.length });
}
