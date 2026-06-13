import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import {
  scoreLead,
  normalizeState,
  normalizeEntityType,
  generateSampleFilings,
  buildIncorporationDateFilter,
  type BusinessLeadInput,
} from '../../../../../lib/business-leads';

export const dynamic = 'force-dynamic';

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
]);

type Source = 'sample' | 'manual' | 'opencorporates' | 'api';

// ── Free OpenCorporates connector (best-effort, never throws) ────────────────
// Works with or without OPENCORPORATES_API_TOKEN (set in Vercel env if available).
// If the network policy blocks it, the tier is rate-limited, or no token is
// configured, we return [] so ingestion degrades gracefully instead of failing.
async function fetchOpenCorporates(
  query?: string,
  jurisdiction?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<BusinessLeadInput[]> {
  try {
    const params = new URLSearchParams({ per_page: '30' });
    if (query) params.set('q', query);
    if (jurisdiction) params.set('jurisdiction_code', jurisdiction.toLowerCase());

    const dateFilter = buildIncorporationDateFilter(dateFrom, dateTo);
    if (dateFilter) {
      params.set('incorporation_date', dateFilter);
      params.set('order', 'incorporation_date');
    } else {
      params.set('order', 'created_at');
    }

    const apiToken = process.env.OPENCORPORATES_API_TOKEN; // optional — required by OC for most queries
    if (apiToken) params.set('api_token', apiToken);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.opencorporates.com/v0.4/companies/search?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const json = await res.json() as {
      results?: { companies?: { company: {
        name?: string;
        company_type?: string;
        jurisdiction_code?: string;
        incorporation_date?: string;
        current_status?: string;
        registered_address_in_full?: string;
        opencorporates_url?: string;
      } }[] };
    };

    const companies = (json.results?.companies ?? []).map(({ company }) => ({
      business_name: company.name ?? '',
      entity_type: company.company_type ?? null,
      state: company.jurisdiction_code?.replace(/^us_/, '').toUpperCase() ?? null,
      filing_date: company.incorporation_date ?? null,
      filing_status: company.current_status ?? null,
      address: company.registered_address_in_full ?? null,
    })).filter((c) => c.business_name);

    // Defense-in-depth: enforce the requested date range client-side too, in
    // case the API ignores/loosely-interprets the incorporation_date filter.
    if (!dateFrom && !dateTo) return companies;
    return companies.filter((c) => {
      if (!c.filing_date) return false;
      if (dateFrom && c.filing_date < dateFrom) return false;
      if (dateTo && c.filing_date > dateTo) return false;
      return true;
    });
  } catch {
    return []; // network blocked / rate-limited / timeout — degrade gracefully
  }
}

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
  } else {
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
  }

  // ── Normalize + score each filing, then upsert (dedupe on name+state) ──
  const now = new Date();
  const rows = rawFilings.map((f) => {
    const lead: BusinessLeadInput = {
      ...f,
      entity_type: normalizeEntityType(f.entity_type),
      state: normalizeState(f.state),
    };
    const { score, grade, breakdown } = scoreLead(lead, now);
    return {
      business_name: lead.business_name,
      entity_type: lead.entity_type,
      state: lead.state,
      filing_date: lead.filing_date || null,
      filing_status: f.filing_status ?? null,
      registered_agent: f.registered_agent ?? null,
      owner_name: f.owner_name ?? null,
      industry: f.industry ?? null,
      address: f.address ?? null,
      website: f.website ?? null,
      email: f.email ?? null,
      phone: f.phone ?? null,
      source,
      source_ref: (f as { source_ref?: string }).source_ref ?? null,
      lead_score: score,
      lead_grade: grade,
      score_breakdown: breakdown,
      status: 'new' as const,
    };
  });

  // Count how many already exist so we can report accurate inserted/skipped.
  let skipped = 0;
  const { data: existing } = await supabaseAdmin
    .from('business_leads')
    .select('business_name, state');
  const existingKeys = new Set(
    (existing ?? []).map((e) => `${(e.business_name ?? '').toLowerCase()}|${(e.state ?? '').toUpperCase()}`),
  );

  const fresh = rows.filter((r) => {
    const key = `${r.business_name.toLowerCase()}|${(r.state ?? '').toUpperCase()}`;
    if (existingKeys.has(key)) { skipped += 1; return false; }
    existingKeys.add(key);
    return true;
  });

  let inserted = 0;
  if (fresh.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('business_leads')
      .insert(fresh)
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted = data?.length ?? 0;
  }

  return NextResponse.json({
    inserted,
    skipped,
    source,
    message: `Stored ${inserted} new ${inserted === 1 ? 'filing' : 'filings'}${skipped > 0 ? ` (${skipped} already on file)` : ''}.`,
  });
}
