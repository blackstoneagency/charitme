import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '../../../../../lib/supabase-server';
import { toSeries, seriesDelta, dailyRaised } from '../../../../../lib/analytics-snapshots-core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns/[id]/snapshots?days=30
 *
 * The recorded history for one campaign — what `analytics_snapshots` exists for.
 *
 * Reads through the SESSION client, unlike the cron writer beside it. That is
 * deliberate: `analytics_owner_private` is a `FOR SELECT` policy, so RLS is a
 * live backstop on this path even though the campaign's ownership is also
 * checked here. The writer has to use the service role because there is no
 * INSERT policy at all.
 */

const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  const { id } = await params;
  const raw = Number(new URL(request.url).searchParams.get('days') ?? DEFAULT_DAYS);
  const days = Number.isFinite(raw) ? Math.min(MAX_DAYS, Math.max(1, Math.floor(raw))) : DEFAULT_DAYS;

  // Ownership checked against the database rather than trusted from the path.
  // RLS would refuse the snapshot read anyway, but a bare empty series would
  // read as "no history yet" rather than "not yours" — two different answers.
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle();
  if (campaignError) {
    return NextResponse.json({ error: 'Campaign unavailable', code: 'READ_FAILED' }, { status: 503 });
  }
  if (!campaign || campaign.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('analytics_snapshots')
    .select('snapshot_date, metrics')
    .eq('campaign_id', id)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })
    .limit(MAX_DAYS);

  if (error) {
    console.warn('[campaign-snapshots] read failed', { code: error.code });
    // 503, never an empty series. "Nothing has been recorded" is a claim about
    // the campaign, and this route would be making it up.
    return NextResponse.json({ error: 'History unavailable', code: 'READ_FAILED' }, { status: 503 });
  }

  const series = toSeries(data ?? []);
  return NextResponse.json({
    days,
    series,
    delta: seriesDelta(series),
    daily: dailyRaised(series),
  });
}
