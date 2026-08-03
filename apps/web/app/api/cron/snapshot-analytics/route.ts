import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../../admin/users/_auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { snapshotDate, type SnapshotMetrics } from '../../../../lib/analytics-snapshots-core';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/cron/snapshot-analytics
 *
 * Records one row per live campaign per day in `analytics_snapshots`, which is
 * what gives a campaign a past. Same auth as the other cron routes: a
 * `Bearer ${CRON_SECRET}` header, or an admin session for a manual run. With
 * `CRON_SECRET` unset the route falls back to demanding an admin session, so an
 * unset value locks cron OUT rather than opening the endpoint.
 *
 * ⚠️ **Writes go through `supabaseAdmin`, and that is not the usual reflex —
 * it is forced.** `analytics_snapshots` has exactly one policy,
 * `analytics_owner_private`, and it is `FOR SELECT`. There is no INSERT policy,
 * so a write through the session client would be refused by RLS. A test asserts
 * that no INSERT policy exists, so if one is ever added this decision gets
 * revisited deliberately rather than left as a stale habit. The READER keeps the
 * session client, where the SELECT policy is a live backstop.
 *
 * **Idempotent per (campaign, date).** A cron firing twice — a retry, or a manual
 * run after the scheduled one — is normal, and there is no unique constraint to
 * lean on, so the day's row is looked up and updated rather than inserted twice.
 */

/** Campaigns are processed in pages so one run cannot load the whole table. */
const PAGE_SIZE = 500;

type CampaignRow = {
  id: string;
  user_id: string;
  raised_amount: number | null;
  goal_amount: number | null;
  backer_count: number | null;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = snapshotDate();
  let written = 0;
  let updated = 0;
  let scanned = 0;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, raised_amount, goal_amount, backer_count')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      // Reported, not swallowed. A snapshot job that silently records nothing
      // leaves a gap in the series that looks exactly like a quiet day.
      console.warn('[cron/snapshot-analytics] campaign read failed', { code: error.code });
      return NextResponse.json(
        { error: 'Campaign read failed', code: 'READ_FAILED', date, written, updated, scanned },
        { status: 503 },
      );
    }

    const page = (data ?? []) as CampaignRow[];
    if (page.length === 0) break;
    scanned += page.length;

    for (const campaign of page) {
      const metrics: SnapshotMetrics = {
        raisedCents: Math.max(0, campaign.raised_amount ?? 0),
        goalCents: Math.max(0, campaign.goal_amount ?? 0),
        backerCount: Math.max(0, campaign.backer_count ?? 0),
        // `backer_count` counts people; this counts donations. They differ once
        // anyone gives twice, and the gap between them is the retention signal.
        donationCount: await countDonations(campaign.id),
      };

      const { data: existing } = await supabaseAdmin
        .from('analytics_snapshots')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('snapshot_date', date)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from('analytics_snapshots')
          .update({ metrics })
          .eq('id', existing.id);
        if (!updateError) updated += 1;
        continue;
      }

      const { error: insertError } = await supabaseAdmin
        .from('analytics_snapshots')
        .insert({
          campaign_id: campaign.id,
          owner_id: campaign.user_id,
          snapshot_date: date,
          metrics,
        });
      if (!insertError) written += 1;
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return NextResponse.json({ ok: true, date, scanned, written, updated });
}

/** `null` on failure is recorded as 0 — see the note on the field above. */
async function countDonations(campaignId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('donations')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);
  if (error) return 0;
  return count ?? 0;
}
