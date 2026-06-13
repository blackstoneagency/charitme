import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '../../users/_auth';
import { generateSampleFilings, type BusinessLeadInput } from '../../../../../lib/business-leads';
import { STATE_FEED_SOURCES } from '../../../../../lib/state-filings';
import {
  fetchOpenCorporates,
  STATE_FETCHERS,
  buildLeadRows,
  upsertLeadRows,
} from '../../../../../lib/lead-ingestion';

export const dynamic = 'force-dynamic';
// Florida's connector downloads + parses a daily file over SFTP, which is
// slower than the other (HTTP API) connectors — give it room to finish.
export const maxDuration = 60;

const FilingSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  entity_type: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  filing_date: z.string().trim().max(40).optional().nullable(),
  filing_status: z.string().trim().max(60).optional().nullable(),
  registered_agent: z.string().trim().max(160).optional().nullable(),
  owner_name: z.string().trim().max(160).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  website: z.string().trim().max(240).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  source_ref: z.string().trim().max(240).optional().nullable(),
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const BodySchema = z.union([
  z.object({ mode: z.literal('sample'), count: z.number().int().min(1).max(50).optional() }),
  z.object({ mode: z.literal('manual'), filings: z.array(FilingSchema).min(1).max(200) }),
  z.object({
    mode: z.literal('opencorporates'),
    query: z.string().trim().min(2).max(120).optional(),
    jurisdiction: z.string().trim().max(20).optional(),
    date_from: z.string().regex(ISO_DATE_RE).optional(),
    date_to: z.string().regex(ISO_DATE_RE).optional(),
  }),
  z.object({
    mode: z.literal('state'),
    state: z.enum(['NY', 'CO', 'FL']),
    date_from: z.string().regex(ISO_DATE_RE).optional(),
    date_to: z.string().regex(ISO_DATE_RE).optional(),
  }),
]);

type Source = 'sample' | 'manual' | 'opencorporates' | 'api' | `state_${string}`;

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  // ── Resolve raw filings from the chosen free source ──
  let rawFilings: BusinessLeadInput[] = [];
  let source: Source = 'manual';

  if (parsed.data.mode === 'sample') {
    source = 'sample';
    rawFilings = generateSampleFilings(parsed.data.count ?? 8);
  } else if (parsed.data.mode === 'manual') {
    source = 'manual';
    rawFilings = parsed.data.filings;
  } else if (parsed.data.mode === 'opencorporates') {
    source = 'opencorporates';
    rawFilings = await fetchOpenCorporates(
      parsed.data.query,
      parsed.data.jurisdiction,
      parsed.data.date_from,
      parsed.data.date_to,
    );
    if (rawFilings.length === 0) {
      const range = parsed.data.date_from || parsed.data.date_to
        ? ` for ${parsed.data.date_from ?? '…'} to ${parsed.data.date_to ?? '…'}`
        : '';
      return NextResponse.json({
        inserted: 0, skipped: 0, source,
        message: `No results from OpenCorporates${range} (requires OPENCORPORATES_API_TOKEN, the free tier may be rate-limited, or there were no filings in this range). Try a wider date range, the sample source, or paste filings manually.`,
      });
    }
  } else {
    const stateCode = parsed.data.state;
    source = `state_${stateCode.toLowerCase()}`;
    rawFilings = await STATE_FETCHERS[stateCode](parsed.data.date_from, parsed.data.date_to);
    if (rawFilings.length === 0) {
      const range = parsed.data.date_from || parsed.data.date_to
        ? ` for ${parsed.data.date_from ?? '…'} to ${parsed.data.date_to ?? '…'}`
        : '';
      return NextResponse.json({
        inserted: 0, skipped: 0, source,
        message: `No new filings from ${STATE_FEED_SOURCES[stateCode].label}${range} (the feed may not have published this range yet). Try a wider date range or the sample source.`,
      });
    }
  }

  // ── Normalize + score each filing, then upsert (dedupe on name+state) ──
  const rows = buildLeadRows(rawFilings, source);
  let inserted = 0;
  let skipped = 0;
  try {
    const result = await upsertLeadRows(rows);
    inserted = result.inserted;
    skipped = result.skipped;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({
    inserted,
    skipped,
    source,
    message: `Stored ${inserted} new ${inserted === 1 ? 'filing' : 'filings'}${skipped > 0 ? ` (${skipped} already on file)` : ''}.`,
  });
}
