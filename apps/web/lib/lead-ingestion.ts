// ─────────────────────────────────────────────────────────────────────────────
// Business-lead ingestion — free-source connectors + upsert logic.
//
// Extracted from the New Customers ingest API route so the same fetchers and
// dedupe/insert logic can be reused by both the admin-triggered ingest route
// and the scheduled cron job (app/api/cron/ingest-filings).
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only';
import SftpClient from 'ssh2-sftp-client';
import { supabaseAdmin } from './supabase';
import {
  scoreLead,
  normalizeState,
  normalizeEntityType,
  buildIncorporationDateFilter,
  type BusinessLeadInput,
  type ScoreBreakdown,
  type LeadGrade,
} from './business-leads';
import {
  NY_DATASET_URL,
  NY_NEW_ENTITY_DOC_TYPES,
  mapNyFiling,
  CO_DATASET_URL,
  CO_NEW_ENTITY_TYPES,
  mapCoFiling,
  FL_SFTP_HOST,
  FL_SFTP_USER,
  FL_SFTP_PASSWORD,
  FL_COR_DIR,
  FL_NEW_ENTITY_FILING_TYPES,
  parseFlCorLine,
  mapFlFiling,
  OR_DATASET_URL,
  OR_NEW_ENTITY_TYPES,
  mapOregonFilings,
  PA_DATASET_URL,
  PA_NEW_ENTITY_TYPES,
  mapPaFiling,
  CT_DATASET_URL,
  CT_NEW_ENTITY_TYPES,
  mapConnecticutFiling,
  TX_DATASET_URL,
  TX_NEW_ENTITY_TYPES,
  mapTexasFiling,
  SF_DATASET_URL,
  mapSanFranciscoFiling,
  CHI_DATASET_URL,
  CHI_LICENSE_CODE,
  mapChicagoFiling,
  NORFOLK_DATASET_URL,
  mapNorfolkFiling,
  type NyFilingRow,
  type CoFilingRow,
  type OrFilingRow,
  type PaFilingRow,
  type CtFilingRow,
  type TxFilingRow,
  type SfFilingRow,
  type ChicagoFilingRow,
  type NorfolkFilingRow,
  type StateFeedCode,
} from './state-filings';

// ── Free OpenCorporates connector (best-effort, never throws) ────────────────
// Works with or without OPENCORPORATES_API_TOKEN (set in Vercel env if available).
// If the network policy blocks it, the tier is rate-limited, or no token is
// configured, we return [] so ingestion degrades gracefully instead of failing.
export async function fetchOpenCorporates(
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

// ── Free state-registry connectors (best-effort, never throw) ────────────────
// New York Dept. of State "All Filings" — free, no API key, updated daily.
// Filtered to ARTICLES OF ORGANIZATION / CERTIFICATE OF INCORPORATION so
// results are brand-new LLC/Corp formations, not amendments or dissolutions.
export async function fetchNewYorkFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const typeList = NY_NEW_ENTITY_DOC_TYPES.map((t) => `'${t}'`).join(', ');
    const clauses = [`documenttype IN(${typeList})`];
    if (dateFrom) clauses.push(`date_filed >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`date_filed <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'date_filed DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${NY_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as NyFilingRow[];
    return rows.map(mapNyFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// Colorado Secretary of State "Business Entities in Colorado" — free, no API
// key, updated regularly. Filtered to domestic LLC/Corp/Nonprofit entity-type
// codes so results are brand-new formations, not foreign qualifications or
// existing-entity record updates.
export async function fetchColoradoFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const typeList = CO_NEW_ENTITY_TYPES.map((t) => `'${t}'`).join(', ');
    const clauses = [`entitytype IN(${typeList})`];
    if (dateFrom) clauses.push(`entityformdate >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`entityformdate <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'entityformdate DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${CO_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as CoFilingRow[];
    return rows.map(mapCoFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// Most recent `maxDays` calendar dates (YYYY-MM-DD, newest first) covering the
// requested range, capped to bound how many Sunbiz daily files we download.
export function floridaDateRange(dateFrom?: string, dateTo?: string, maxDays = 3): string[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const end = dateTo ?? dateFrom ?? todayIso;
  const start = dateFrom ?? dateTo ?? todayIso;
  const endDate = new Date(`${end}T00:00:00Z`);
  const startDate = new Date(`${start}T00:00:00Z`);

  const dates: string[] = [];
  for (const d = new Date(endDate); d >= startDate && dates.length < maxDays; d.setUTCDate(d.getUTCDate() - 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Florida Division of Corporations (Sunbiz) daily corporate data file — free,
// published SFTP credentials, updated daily. Each /doc/cor/yyyymmddc.txt
// covers one calendar day of corporate-record transactions; we keep only
// records whose original formation date (fileDate) matches that day, so
// results are brand-new domestic LLC/Corp/Nonprofit formations, not
// transactions against pre-existing entities.
export async function fetchFloridaFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  const dates = floridaDateRange(dateFrom, dateTo);
  const sftp = new SftpClient();
  const out: BusinessLeadInput[] = [];
  try {
    await sftp.connect({
      host: FL_SFTP_HOST,
      port: 22,
      username: FL_SFTP_USER,
      password: FL_SFTP_PASSWORD,
      readyTimeout: 8000,
    });

    for (const date of dates) {
      if (out.length >= limit) break;
      const yyyymmdd = date.replace(/-/g, '');
      let buf: Buffer;
      try {
        buf = await sftp.get(`${FL_COR_DIR}/${yyyymmdd}c.txt`) as Buffer;
      } catch {
        continue; // file not published for this date (yet) — try other dates
      }

      for (const line of buf.toString('latin1').split(/\r?\n/)) {
        if (out.length >= limit) break;
        const row = parseFlCorLine(line);
        if (!row || !row.corporationName) continue;
        if (row.status !== 'A') continue;
        if (!(FL_NEW_ENTITY_FILING_TYPES as readonly string[]).includes(row.filingType)) continue;
        if (row.fileDate !== date) continue; // only entities formed on this exact day
        out.push(mapFlFiling(row));
      }
    }
    return out;
  } catch {
    return []; // SFTP blocked / unreachable / timeout — degrade gracefully
  } finally {
    await sftp.end().catch(() => {});
  }
}

// Oregon Secretary of State "New Businesses Registered Last Month" — free, no
// API key, refreshed monthly. Filtered to domestic LLC/Corp/Nonprofit/etc.
// entity types so results are brand-new in-state formations. Each business
// spans several rows (one per associated_name_type); mapOregonFilings groups
// them and uniquely surfaces the filer's first/last name. `limit` is the
// number of *businesses* returned — we over-fetch rows to account for the
// ~5-6 rows per business, then group and slice.
export async function fetchOregonFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const typeList = OR_NEW_ENTITY_TYPES.map((t) => `'${t}'`).join(', ');
    const clauses = [`entity_type IN(${typeList})`];
    if (dateFrom) clauses.push(`registry_date >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`registry_date <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'registry_date DESC',
      $limit: String(limit * 6),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${OR_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as OrFilingRow[];
    return mapOregonFilings(rows).filter((f) => f.business_name).slice(0, limit);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// Pennsylvania Dept. of State "Registered Businesses in PA Current" — free, no
// API key. Filtered to domestic LLC/Corp/Nonprofit/etc. registration types so
// results are brand-new in-state formations, not foreign qualifications. Each
// row already includes the Organizer/Incorporator's first/middle/last name.
export async function fetchPennsylvaniaFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const typeList = PA_NEW_ENTITY_TYPES.map((t) => `'${t}'`).join(', ');
    const clauses = [`typeofbusinessregistration IN(${typeList})`];
    if (dateFrom) clauses.push(`creationdate >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`creationdate <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'creationdate DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${PA_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as PaFilingRow[];
    return rows.map(mapPaFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// Connecticut SOS "Business Registry - Business Master" — free, no API key.
// Filtered to domestic LLC/Corp/Nonprofit/etc. business types so results are
// brand-new in-state formations. Uniquely, each row already includes the
// registrant's email address.
export async function fetchConnecticutFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const typeList = CT_NEW_ENTITY_TYPES.map((t) => `'${t}'`).join(', ');
    const clauses = [`business_type IN(${typeList})`];
    if (dateFrom) clauses.push(`date_registration >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`date_registration <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'date_registration DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${CT_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as CtFilingRow[];
    return rows.map(mapConnecticutFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// Texas Comptroller "Active Sales Tax Permit Holders" — free, no API key.
// Filtered to in-state for-profit organization-type codes (LLC, Corp,
// Professional Corp/Assoc, LP) so results are newly-permitted local
// businesses, not sole proprietors, out-of-state corporations, or nonprofits.
export async function fetchTexasFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const typeList = TX_NEW_ENTITY_TYPES.map((t) => `'${t}'`).join(', ');
    const clauses = [`taxpayer_organization_type IN(${typeList})`, 'outlet_permit_issue_date IS NOT NULL'];
    if (dateFrom) clauses.push(`outlet_permit_issue_date >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`outlet_permit_issue_date <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'outlet_permit_issue_date DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${TX_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as TxFilingRow[];
    return rows.map(mapTexasFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// San Francisco "Registered Business Locations" — free, no API key. Used as a
// proxy for new CA business activity since CA's Secretary of State doesn't
// publish a free open-data feed of new entity filings. Filtered to rows with
// a `dba_start_date` (i.e. newly-registered) in the requested date range.
export async function fetchCaliforniaFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const clauses = ['dba_start_date IS NOT NULL'];
    if (dateFrom) clauses.push(`dba_start_date >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`dba_start_date <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'dba_start_date DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${SF_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as SfFilingRow[];
    return rows.map(mapSanFranciscoFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// City of Chicago "Business Licenses" — free, no API key. Used as a proxy for
// new IL business activity since IL's Secretary of State doesn't publish a
// free open-data feed of new entity filings. Filtered to newly-ISSUEd base
// "Limited Business License" (1010) records in the requested date range.
export async function fetchIllinoisFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const clauses = [`license_code='${CHI_LICENSE_CODE}'`, "application_type='ISSUE'"];
    if (dateFrom) clauses.push(`date_issued >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`date_issued <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'date_issued DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${CHI_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as ChicagoFilingRow[];
    return rows.map(mapChicagoFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

// City of Norfolk "Business Licenses" — free, no API key. Used as a proxy for
// new VA business activity since VA's SCC only publishes a single bulk CSV of
// all-time LLC filings with no date filter or contact info. Filtered to rows
// with a `business_opened_date` in the requested date range.
export async function fetchVirginiaFilings(dateFrom?: string, dateTo?: string, limit = 50): Promise<BusinessLeadInput[]> {
  try {
    const clauses = ['business_opened_date IS NOT NULL'];
    if (dateFrom) clauses.push(`business_opened_date >= '${dateFrom}T00:00:00'`);
    if (dateTo) clauses.push(`business_opened_date <= '${dateTo}T23:59:59'`);

    const params = new URLSearchParams({
      $where: clauses.join(' AND '),
      $order: 'business_opened_date DESC',
      $limit: String(limit),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${NORFOLK_DATASET_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const rows = await res.json() as NorfolkFilingRow[];
    return rows.map(mapNorfolkFiling).filter((f) => f.business_name);
  } catch {
    return []; // network blocked / timeout — degrade gracefully
  }
}

export const STATE_FETCHERS: Record<StateFeedCode, (dateFrom?: string, dateTo?: string) => Promise<BusinessLeadInput[]>> = {
  NY: fetchNewYorkFilings,
  CO: fetchColoradoFilings,
  FL: fetchFloridaFilings,
  OR: fetchOregonFilings,
  PA: fetchPennsylvaniaFilings,
  CT: fetchConnecticutFilings,
  TX: fetchTexasFilings,
  CA: fetchCaliforniaFilings,
  IL: fetchIllinoisFilings,
  VA: fetchVirginiaFilings,
};

// ── Normalize + score raw filings, then dedupe/insert into business_leads ────

export interface LeadRow {
  business_name: string;
  entity_type: string | null;
  state: string | null;
  filing_date: string | null;
  filing_status: string | null;
  registered_agent: string | null;
  owner_name: string | null;
  industry: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  source_ref: string | null;
  lead_score: number;
  lead_grade: LeadGrade;
  score_breakdown: ScoreBreakdown;
  status: 'new';
}

export function buildLeadRows(rawFilings: BusinessLeadInput[], source: string, now: Date = new Date()): LeadRow[] {
  return rawFilings.map((f) => {
    const lead: BusinessLeadInput = {
      ...f,
      entity_type: normalizeEntityType(f.entity_type),
      state: normalizeState(f.state),
    };
    const { score, grade, breakdown } = scoreLead(lead, now);
    return {
      business_name: lead.business_name,
      entity_type: lead.entity_type ?? null,
      state: lead.state ?? null,
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
      status: 'new',
    };
  });
}

// Dedupes against existing rows (by lower(business_name) + upper(state)) and
// inserts the remainder. Returns inserted ids so callers (e.g. the cron job)
// can immediately enrich the freshly-created leads.
export async function upsertLeadRows(rows: LeadRow[]): Promise<{ inserted: number; skipped: number; insertedIds: string[] }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0, insertedIds: [] };

  const { data: existing } = await supabaseAdmin
    .from('business_leads')
    .select('business_name, state');
  const existingKeys = new Set(
    (existing ?? []).map((e) => `${(e.business_name ?? '').toLowerCase()}|${(e.state ?? '').toUpperCase()}`),
  );

  let skipped = 0;
  const fresh = rows.filter((r) => {
    const key = `${r.business_name.toLowerCase()}|${(r.state ?? '').toUpperCase()}`;
    if (existingKeys.has(key)) { skipped += 1; return false; }
    existingKeys.add(key);
    return true;
  });

  if (fresh.length === 0) return { inserted: 0, skipped, insertedIds: [] };

  const { data, error } = await supabaseAdmin
    .from('business_leads')
    .insert(fresh)
    .select('id');
  if (error) throw new Error(error.message);
  return { inserted: data?.length ?? 0, skipped, insertedIds: (data ?? []).map((d) => d.id as string) };
}
