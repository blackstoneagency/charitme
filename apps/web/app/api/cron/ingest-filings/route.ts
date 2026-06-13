import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '../../admin/users/_auth';
import { STATE_FEED_SOURCES, type StateFeedCode } from '../../../../lib/state-filings';
import {
  fetchOpenCorporates,
  STATE_FETCHERS,
  buildLeadRows,
  upsertLeadRows,
} from '../../../../lib/lead-ingestion';
import { enrichLead } from '../../../../lib/lead-enrichment';

export const dynamic = 'force-dynamic';
// Runs every connector (incl. Florida's SFTP pull) plus AI enrichment for
// each newly-found lead — give this plenty of room on Vercel.
export const maxDuration = 280;

// Caps how many freshly-ingested leads get AI-enriched per run, so a busy
// day can't blow the function's time budget or rack up OpenAI usage.
const MAX_ENRICH_PER_RUN = 20;

type SourceResult = { inserted: number; skipped: number; error?: string };

// Yesterday through today (UTC) — "the latest data over the last day",
// covering feeds with a short publishing lag.
function lastDayRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

async function runIngestion(actorId: string | null) {
  const { from, to } = lastDayRange();
  const bySource: Record<string, SourceResult> = {};
  const insertedIds: string[] = [];

  for (const state of Object.keys(STATE_FEED_SOURCES) as StateFeedCode[]) {
    const source = `state_${state.toLowerCase()}`;
    try {
      const raw = await STATE_FETCHERS[state](from, to);
      const { inserted, skipped, insertedIds: ids } = await upsertLeadRows(buildLeadRows(raw, source));
      bySource[source] = { inserted, skipped };
      insertedIds.push(...ids);
    } catch (err) {
      bySource[source] = { inserted: 0, skipped: 0, error: err instanceof Error ? err.message : 'fetch failed' };
    }
  }

  try {
    const raw = await fetchOpenCorporates(undefined, undefined, from, to);
    const { inserted, skipped, insertedIds: ids } = await upsertLeadRows(buildLeadRows(raw, 'opencorporates'));
    bySource.opencorporates = { inserted, skipped };
    insertedIds.push(...ids);
  } catch (err) {
    bySource.opencorporates = { inserted: 0, skipped: 0, error: err instanceof Error ? err.message : 'fetch failed' };
  }

  // ── Auto-enrich the freshest leads (website/email/phone + scoring + alerts) ──
  const toEnrich = insertedIds.slice(0, MAX_ENRICH_PER_RUN);
  let enriched = 0;
  let alerted = 0;
  const enrichErrors: string[] = [];
  for (const id of toEnrich) {
    try {
      const result = await enrichLead(id, actorId);
      if ('error' in result) { enrichErrors.push(`${id}: ${result.error}`); continue; }
      enriched += 1;
      if (result.alerted) alerted += 1;
    } catch (err) {
      enrichErrors.push(`${id}: ${err instanceof Error ? err.message : 'enrich failed'}`);
    }
  }

  return {
    ok: true,
    ranAt: new Date().toISOString(),
    range: { from, to },
    sources: bySource,
    inserted: insertedIds.length,
    enriched,
    enrichSkipped: Math.max(0, insertedIds.length - toEnrich.length),
    alerted,
    enrichErrors,
  };
}

// GET /api/cron/ingest-filings
//
// Pulls the last day of new business filings from every free state connector
// (NY/CO/FL) and OpenCorporates, dedupes/inserts into business_leads, then
// auto-enriches (website/email/phone + scoring + admin alerts) the freshest
// leads. Designed to be triggered by Vercel Cron (see vercel.json), which
// sends `Authorization: Bearer ${CRON_SECRET}`. Admins can also trigger it
// manually from a logged-in session for testing.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  let actorId: string | null = null;
  if (!isCron) {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    actorId = admin.id;
  }

  const result = await runIngestion(actorId);
  return NextResponse.json(result);
}
