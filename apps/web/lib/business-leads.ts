// ─────────────────────────────────────────────────────────────────────────────
// Business-lead pipeline — pure, dependency-free logic.
//
// Kept free of DB / network / framework imports so it can be unit-tested
// deterministically (see __tests__/business-leads.test.ts) and reused by the
// Admin "New Customers" API routes.
// ─────────────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new'
  | 'enriched'
  | 'contacted'
  | 'qualified'
  | 'converted'
  | 'rejected';

export type LeadGrade = 'A' | 'B' | 'C' | 'D';

export interface BusinessLeadInput {
  business_name: string;
  entity_type?: string | null;
  state?: string | null;
  filing_date?: string | null;
  filing_status?: string | null;
  registered_agent?: string | null;
  owner_name?: string | null;
  industry?: string | null;
  address?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ScoreBreakdown {
  website: number;
  email: number;
  phone: number;
  entityType: number;
  recency: number;
  industry: number;
  completeness: number;
}

export interface ScoreResult {
  score: number;
  grade: LeadGrade;
  breakdown: ScoreBreakdown;
}

// Industries most likely to run fundraising / community-giving campaigns on
// CharitMe. Matching any keyword earns industry-fit points.
export const TARGET_INDUSTRY_KEYWORDS: readonly string[] = [
  'nonprofit', 'non-profit', 'charity', 'foundation', 'church', 'ministry',
  'faith', 'community', 'school', 'education', 'youth', 'sports', 'athletic',
  'club', 'association', 'health', 'medical', 'clinic', 'hospice', 'rescue',
  'animal', 'shelter', 'arts', 'cultural', 'volunteer', 'relief', 'care',
];

// Entity types that signal a real organization (vs. a holding shell).
const ORG_ENTITY_HINTS: readonly string[] = [
  'nonprofit', 'non-profit', 'foundation', 'association', 'corporation', 'corp', 'inc',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// North-American style phone: 10 digits, optional +1 / formatting.
const PHONE_DIGITS_RE = /\d/g;

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = (value.match(PHONE_DIGITS_RE) ?? []).join('');
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return null; // not a valid NANP number — treat as missing
}

export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const m = trimmed.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:[/?#].*)?$/i);
  return m ? m[1].toLowerCase() : null;
}

export function normalizeWebsite(url: string | null | undefined): string | null {
  const domain = extractDomain(url);
  return domain ? `https://${domain}` : null;
}

export function normalizeState(value: string | null | undefined): string | null {
  if (!value) return null;
  const up = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(up) ? up : (value.trim() || null);
}

export function normalizeEntityType(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower.includes('limited liability') || /\bllc\b/.test(lower)) return 'LLC';
  if (/\bl\.?l\.?p\b/.test(lower) || lower.includes('limited liability partnership')) return 'LLP';
  if (lower.includes('nonprofit') || lower.includes('non-profit')) return 'Nonprofit';
  if (/\bcorp\b/.test(lower) || lower.includes('corporation') || /\binc\b/.test(lower)) return 'Corporation';
  return v;
}

// ── OpenCorporates query helpers ─────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds OpenCorporates' `incorporation_date` filter value from an optional
 * from/to range (each `YYYY-MM-DD` or omitted). Mirrors OC's documented
 * syntax: exact date, `from:to` range, or open-ended `from:` / `:to`.
 * Returns null when neither bound is a valid date (no filter applied).
 */
export function buildIncorporationDateFilter(dateFrom?: string | null, dateTo?: string | null): string | null {
  const from = (dateFrom && ISO_DATE_RE.test(dateFrom)) ? dateFrom : null;
  const to = (dateTo && ISO_DATE_RE.test(dateTo)) ? dateTo : null;
  if (!from && !to) return null;
  if (from && to) return from === to ? from : `${from}:${to}`;
  return from ? `${from}:` : `:${to}`;
}

function gradeForScore(score: number): LeadGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * Days between the filing date and `asOf`. Returns null when unknown.
 */
function daysSinceFiling(filingDate: string | null | undefined, asOf: Date): number | null {
  if (!filingDate) return null;
  const filed = new Date(filingDate);
  if (Number.isNaN(filed.getTime())) return null;
  const diff = Math.floor((asOf.getTime() - filed.getTime()) / 86_400_000);
  return diff < 0 ? 0 : diff;
}

/**
 * Deterministic 0-100 lead score. Higher = more contactable + better fit.
 *
 * Weights (max): website 20, email 25, phone 15, entityType 10,
 * recency 15, industry 10, completeness 5.
 */
export function scoreLead(lead: BusinessLeadInput, asOf: Date = new Date()): ScoreResult {
  const breakdown: ScoreBreakdown = {
    website: 0, email: 0, phone: 0, entityType: 0, recency: 0, industry: 0, completeness: 0,
  };

  // Contactability — the single most valuable signal for outbound BD.
  if (normalizeWebsite(lead.website)) breakdown.website = 20;
  if (isValidEmail(lead.email)) breakdown.email = 25;
  if (normalizePhone(lead.phone)) breakdown.phone = 15;

  // Entity type fit.
  const entity = normalizeEntityType(lead.entity_type);
  if (entity) {
    const lower = entity.toLowerCase();
    breakdown.entityType = ORG_ENTITY_HINTS.some((h) => lower.includes(h)) ? 10 : 6;
  }

  // Recency — fresh filings convert best. Full points <30d, decaying to 0 by ~120d.
  const age = daysSinceFiling(lead.filing_date, asOf);
  if (age !== null) {
    if (age <= 30) breakdown.recency = 15;
    else if (age <= 60) breakdown.recency = 10;
    else if (age <= 120) breakdown.recency = 5;
    else breakdown.recency = 0;
  }

  // Industry fit.
  const haystack = `${lead.industry ?? ''} ${lead.business_name ?? ''}`.toLowerCase();
  if (TARGET_INDUSTRY_KEYWORDS.some((kw) => haystack.includes(kw))) {
    breakdown.industry = 10;
  }

  // Record completeness — small bonus for having owner + address on file.
  let completePts = 0;
  if (lead.owner_name && lead.owner_name.trim()) completePts += 3;
  if (lead.address && lead.address.trim()) completePts += 2;
  breakdown.completeness = completePts;

  const score = Math.min(
    100,
    breakdown.website + breakdown.email + breakdown.phone + breakdown.entityType +
    breakdown.recency + breakdown.industry + breakdown.completeness,
  );

  return { score, grade: gradeForScore(score), breakdown };
}

// A lead at/above this score triggers an admin alert.
export const ALERT_SCORE_THRESHOLD = 60;

export function shouldAlertAdmin(score: number): boolean {
  return score >= ALERT_SCORE_THRESHOLD;
}

// ── Enrichment parsing ───────────────────────────────────────────────────────
// The AI returns a JSON blob of guessed contact details. Never trust it blindly:
// validate + normalize every field, dropping anything that doesn't look real.

export interface EnrichmentResult {
  website: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export function parseEnrichment(raw: unknown): EnrichmentResult {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const asStr = (v: unknown): string | null =>
    (typeof v === 'string' && v.trim()) ? v.trim() : null;

  return {
    website: normalizeWebsite(asStr(obj.website)),
    email: (() => { const e = asStr(obj.email); return e && isValidEmail(e) ? e.toLowerCase() : null; })(),
    phone: normalizePhone(asStr(obj.phone)),
    notes: asStr(obj.notes),
  };
}

// ── Deterministic enrichment fallback ────────────────────────────────────────
// When OpenAI isn't configured we still produce a best-effort, clearly-guessed
// website so the pipeline is fully demonstrable for free. We never fabricate
// emails/phones (those would be misleading), only a plausible domain guess.

function slugForDomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|l\.l\.c\.|inc|inc\.|corp|corporation|co|company|ltd|limited|the)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

export function fallbackEnrichment(lead: BusinessLeadInput): EnrichmentResult {
  const slug = slugForDomain(lead.business_name);
  const guessedWebsite = slug.length >= 3 ? `https://${slug}.com` : null;
  return {
    website: lead.website ? normalizeWebsite(lead.website) : guessedWebsite,
    email: isValidEmail(lead.email) ? (lead.email as string).toLowerCase() : null,
    phone: normalizePhone(lead.phone),
    notes: guessedWebsite
      ? 'Website is an automated domain guess — verify before outreach. Configure OPENAI_API_KEY for richer enrichment.'
      : 'No reliable contact info found from the filing alone.',
  };
}

// ── Sample free data source ──────────────────────────────────────────────────
// Generates realistic newly-filed-LLC records so the pipeline always has data
// to demonstrate — no paid API required. Mirrors what a free Secretary-of-State
// feed exposes (name, type, state, filing date, agent, address).

const SAMPLE_PREFIXES = [
  'Riverside', 'Summit', 'Maple Grove', 'Harborview', 'Cedar Creek', 'Lakeside',
  'Brightpath', 'Evergreen', 'Northgate', 'Sunrise', 'Heritage', 'Pinewood',
  'Stonebridge', 'Clearwater', 'Goldenfield', 'Trinity', 'Hopewell', 'Unity',
];
const SAMPLE_SUFFIXES = [
  'Community Foundation', 'Youth Sports Club', 'Animal Rescue', 'Family Care',
  'Faith Ministries', 'Arts Collective', 'Health Services', 'Education Fund',
  'Volunteer Network', 'Relief Initiative', 'Holdings', 'Ventures', 'Consulting',
  'Logistics', 'Properties',
];
const SAMPLE_STATES = ['DE', 'FL', 'CA', 'TX', 'NY', 'WY', 'NV', 'GA'];
const SAMPLE_AGENTS = [
  'Registered Agents Inc', 'Northwest Agent LLC', 'Cogency Global',
  'Harbor Compliance', 'InCorp Services',
];
const SAMPLE_CITIES: Record<string, string> = {
  DE: 'Wilmington, DE', FL: 'Miami, FL', CA: 'Los Angeles, CA', TX: 'Austin, TX',
  NY: 'New York, NY', WY: 'Cheyenne, WY', NV: 'Las Vegas, NV', GA: 'Atlanta, GA',
};

export interface SampleFiling extends BusinessLeadInput {
  business_name: string;
  source: 'sample';
}

/**
 * Deterministic sample generator (seedable) so tests are stable and demos are
 * repeatable. `seed` advances the pseudo-random sequence.
 */
export function generateSampleFilings(count: number, seed = Date.now()): SampleFiling[] {
  const out: SampleFiling[] = [];
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  const next = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)];

  const used = new Set<string>();
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard += 1;
    const name = `${pick(SAMPLE_PREFIXES)} ${pick(SAMPLE_SUFFIXES)} LLC`;
    const state = pick(SAMPLE_STATES);
    const key = `${name.toLowerCase()}|${state}`;
    if (used.has(key)) continue;
    used.add(key);

    const daysAgo = Math.floor(next() * 45); // filed within the last ~45 days
    const filed = new Date(Date.now() - daysAgo * 86_400_000);

    out.push({
      business_name: name,
      entity_type: 'LLC',
      state,
      filing_date: filed.toISOString().slice(0, 10),
      filing_status: 'Active',
      registered_agent: pick(SAMPLE_AGENTS),
      address: SAMPLE_CITIES[state],
      owner_name: null,
      source: 'sample',
    });
  }
  return out;
}
