// ─────────────────────────────────────────────────────────────────────────────
// Free state-registry filing sources — pure, dependency-free mapping logic.
//
// OpenCorporates now requires a paid API token for most queries, so this module
// targets state open-data feeds directly: free, no API key, queryable by date.
//
// Kept free of network imports so the row → BusinessLeadInput mappers can be
// unit-tested deterministically (see __tests__/state-filings.test.ts). The
// actual fetch() calls live in the ingest route, mirroring fetchOpenCorporates.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeEntityType, type BusinessLeadInput } from './business-leads';

export interface StateFilingLead extends BusinessLeadInput {
  source_ref?: string;
}

// ── New York — Dept. of State "Corporations and Other Entities: All Filings" ──
// https://data.ny.gov/resource/63wc-4exh.json — free, no API key, updated daily.
// `documenttype` distinguishes brand-new formations from amendments/dissolutions/etc.

export const NY_DATASET_URL = 'https://data.ny.gov/resource/63wc-4exh.json';

// Filing types that represent a brand-new domestic entity (not an amendment,
// dissolution, biennial statement, foreign qualification, etc.)
export const NY_NEW_ENTITY_DOC_TYPES = ['ARTICLES OF ORGANIZATION', 'CERTIFICATE OF INCORPORATION'] as const;

export interface NyFilingRow {
  corpid_num?: string;
  corp_name?: string;
  entitytype?: string;
  documenttype?: string;
  date_filed?: string;
  cnty_prin_ofc?: string;
  nfp_type?: string;
}

const NY_NFP_PLACEHOLDERS = new Set(['', 'NO-ANSWER', 'NOT APPLICABLE', 'N/A']);

// Entity-type suffixes/abbreviations to keep upper-cased when title-casing a
// name (NY publishes names in ALL CAPS, e.g. "CHIAPPERINO LLC").
const KEEP_UPPERCASE = new Set([
  'LLC', 'LLP', 'LP', 'LLLP', 'PLLC', 'PC', 'PLC', 'INC', 'CORP', 'CO', 'LTD', 'DBA', 'USA',
]);

// Roman numerals (e.g. "III", "IV", "XII") that appear as standalone words in
// business names (e.g. "Associates III, Inc.") should stay upper-cased rather
// than becoming "Iii"/"Iv". Single-letter words already title-case correctly.
const ROMAN_NUMERAL_RE = /^[IVXLCDM]{2,}$/;

export function titleCaseBusinessName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const bare = word.replace(/[.,]/g, '').toUpperCase();
      if (KEEP_UPPERCASE.has(bare) || ROMAN_NUMERAL_RE.test(bare)) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Title-cases a name only if it's "shouting" (all caps), leaving names that
// already have intentional mixed case (e.g. acronyms like "TLC") untouched.
// NY always publishes in ALL CAPS; CO is a mix depending on the filer.
export function maybeTitleCase(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed === trimmed.toUpperCase() ? titleCaseBusinessName(trimmed) : trimmed;
}

export function mapNyFiling(row: NyFilingRow): StateFilingLead {
  const county = row.cnty_prin_ofc?.trim();
  const nfp = row.nfp_type?.trim().toUpperCase() ?? '';
  return {
    business_name: titleCaseBusinessName(row.corp_name ?? ''),
    entity_type: normalizeEntityType(row.entitytype ?? null),
    state: 'NY',
    filing_date: row.date_filed ? row.date_filed.slice(0, 10) : null,
    filing_status: row.documenttype ?? null,
    address: county ? `${county} County, NY` : null,
    industry: NY_NFP_PLACEHOLDERS.has(nfp) ? null : (row.nfp_type ?? null),
    source_ref: row.corpid_num ? `ny-dos:${row.corpid_num}` : undefined,
  };
}

// ── Colorado — Secretary of State "Business Entities in Colorado" ────────────
// https://data.colorado.gov/resource/4ykn-tg5h.json — free, no API key, full
// registry since 1864, updated regularly. `entityformdate` is the formation
// date; `entitytype` distinguishes brand-new domestic LLCs/corporations from
// foreign qualifications, partnerships, trusts, cooperatives, etc.

export const CO_DATASET_URL = 'https://data.colorado.gov/resource/4ykn-tg5h.json';

// Domestic entity-type codes representing brand-new LLC/Corp/Nonprofit
// formations (excludes foreign qualifications, partnerships, trusts, etc.)
export const CO_NEW_ENTITY_TYPES = ['DLLC', 'DPC', 'DNC'] as const;

const CO_ENTITY_TYPE_LABELS: Record<string, string> = {
  DLLC: 'Domestic Limited Liability Company',
  DPC: 'Domestic Profit Corporation',
  DNC: 'Domestic Nonprofit Corporation',
};

export interface CoFilingRow {
  entityid?: string | number;
  entityname?: string;
  entitytype?: string;
  entitystatus?: string;
  entityformdate?: string;
  principaladdress1?: string;
  principalcity?: string;
  principalstate?: string;
  principalzipcode?: string;
  agentfirstname?: string;
  agentmiddlename?: string;
  agentlastname?: string;
  agentorganizationname?: string;
}

function coRegisteredAgent(row: CoFilingRow): string | null {
  const org = row.agentorganizationname?.trim();
  if (org) return org;
  const parts = [row.agentfirstname, row.agentmiddlename, row.agentlastname]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.length ? parts.join(' ') : null;
}

function coAddress(row: CoFilingRow): string | null {
  const stateZip = [row.principalstate?.trim(), row.principalzipcode?.trim()].filter(Boolean).join(' ');
  const parts = [row.principaladdress1?.trim(), row.principalcity?.trim(), stateZip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function mapCoFiling(row: CoFilingRow): StateFilingLead {
  const typeCode = row.entitytype?.trim().toUpperCase() ?? '';
  return {
    business_name: maybeTitleCase(row.entityname ?? ''),
    entity_type: normalizeEntityType(CO_ENTITY_TYPE_LABELS[typeCode] ?? row.entitytype ?? null),
    state: 'CO',
    filing_date: row.entityformdate ? row.entityformdate.slice(0, 10) : null,
    filing_status: row.entitystatus ?? null,
    registered_agent: coRegisteredAgent(row),
    address: coAddress(row),
    industry: null,
    source_ref: row.entityid != null ? `co-sos:${row.entityid}` : undefined,
  };
}

// ── Florida — Division of Corporations "Sunbiz" daily corporate data file ───
// sftp://sftp.floridados.gov (user "Public", free published credentials) —
// /doc/cor/yyyymmddc.txt, a fixed-width (1440 chars/record) extract of every
// corporate-record transaction processed that day. `fileDate` is the
// entity's *original formation* date (separate from the daily-batch date),
// so a brand-new formation has fileDate === the date of the file it appears
// in. `filingType` distinguishes domestic LLC/Corp/Nonprofit formations from
// foreign qualifications, partnerships, trusts, and agent designations.
//
// Field layout per https://dos.sunbiz.org/data-definitions/cor.html (1-indexed
// start/length, converted below to 0-indexed slice ranges):
//   Corporation Number      1  / 12   →  [0, 12)
//   Corporation Name        13 / 192  →  [12, 204)
//   Status                  205 / 1   →  [204, 205)   'A' active, 'I' inactive
//   Filing Type             206 / 15  →  [205, 220)
//   Principal Address 1     221 / 42  →  [220, 262)
//   Principal City          305 / 28  →  [304, 332)
//   Principal State         333 / 2   →  [332, 334)
//   Principal Zip           335 / 10  →  [334, 344)
//   File Date (CCYYMMDD)    473 / 8   →  [472, 480)
//   Registered Agent Name   545 / 42  →  [544, 586)
//
// NOTE: this connector could not be exercised against live Sunbiz data —
// outbound SFTP (port 22) is blocked in the development sandbox. The field
// positions/codes follow Sunbiz's published spec; mapFlFiling/parseFlCorLine
// are unit-tested against hand-built fixed-width records matching that spec.

export const FL_SFTP_HOST = 'sftp.floridados.gov';
export const FL_SFTP_USER = 'Public';
export const FL_SFTP_PASSWORD = 'PubAccess1845!';
export const FL_COR_DIR = '/doc/cor';

const FL_FIELD_RANGES = {
  corporationNumber: [0, 12],
  corporationName: [12, 204],
  status: [204, 205],
  filingType: [205, 220],
  addressLine1: [220, 262],
  city: [304, 332],
  state: [332, 334],
  zip: [334, 344],
  fileDate: [472, 480],
  registeredAgentName: [544, 586],
} as const;

// Minimum line length to safely read through the File Date field.
export const FL_COR_MIN_LENGTH = 480;

// Filing types representing a brand-new domestic LLC/Corp/Nonprofit formation
// (excludes foreign qualifications, partnerships, trusts, agent designations).
export const FL_NEW_ENTITY_FILING_TYPES = ['DOMP', 'DOMNP', 'FLAL'] as const;

const FL_FILING_TYPE_LABELS: Record<string, string> = {
  DOMP: 'Domestic Profit Corporation',
  DOMNP: 'Domestic Non-Profit Corporation',
  FLAL: 'Florida Limited Liability Company',
  FORP: 'Foreign Profit Corporation',
  FORNP: 'Foreign Non-Profit Corporation',
  FORL: 'Foreign Limited Liability Company',
  DOMLP: 'Domestic Limited Partnership',
  FORLP: 'Foreign Limited Partnership',
};

export interface FlFilingRow {
  corporationNumber: string;
  corporationName: string;
  status: string;
  filingType: string;
  fileDate: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  registeredAgentName: string | null;
}

const FL_DATE_RE = /^\d{8}$/;

// CCYYMMDD → YYYY-MM-DD, or null if not a plausible date.
export function parseFlDate(raw: string): string | null {
  const v = raw.trim();
  if (!FL_DATE_RE.test(v)) return null;
  const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

// Parses one fixed-width record from a Sunbiz cor.txt file. Returns null for
// lines too short to contain the fields we need (e.g. trailing blank lines).
export function parseFlCorLine(line: string): FlFilingRow | null {
  if (line.length < FL_COR_MIN_LENGTH) return null;
  const field = (key: keyof typeof FL_FIELD_RANGES): string => {
    const [start, end] = FL_FIELD_RANGES[key];
    return line.length >= start ? line.slice(start, Math.min(end, line.length)).trim() : '';
  };
  return {
    corporationNumber: field('corporationNumber'),
    corporationName: field('corporationName'),
    status: field('status').toUpperCase(),
    filingType: field('filingType').toUpperCase(),
    fileDate: parseFlDate(field('fileDate')),
    addressLine1: field('addressLine1') || null,
    city: field('city') || null,
    state: field('state') || null,
    zip: field('zip') || null,
    registeredAgentName: field('registeredAgentName') || null,
  };
}

function flAddress(row: FlFilingRow): string | null {
  const stateZip = [row.state, row.zip].filter(Boolean).join(' ');
  const line1 = row.addressLine1 ? maybeTitleCase(row.addressLine1) : null;
  const city = row.city ? maybeTitleCase(row.city) : null;
  const parts = [line1, city, stateZip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function mapFlFiling(row: FlFilingRow): StateFilingLead {
  return {
    business_name: maybeTitleCase(row.corporationName),
    entity_type: normalizeEntityType(FL_FILING_TYPE_LABELS[row.filingType] ?? row.filingType ?? null),
    state: 'FL',
    filing_date: row.fileDate,
    filing_status: row.status === 'A' ? 'Active' : row.status === 'I' ? 'Inactive' : (row.status || null),
    registered_agent: row.registeredAgentName,
    address: flAddress(row),
    industry: null,
    source_ref: row.corporationNumber ? `fl-sunbiz:${row.corporationNumber}` : undefined,
  };
}

// ── Oregon — Secretary of State "New Businesses Registered Last Month" ──────
// https://data.oregon.gov/resource/esjy-u4fc.json — free, no API key, refreshed
// monthly with the prior month's new business registrations. Unlike NY/CO/FL,
// each registry_number spans several rows — one per `associated_name_type`
// (PRINCIPAL PLACE OF BUSINESS, REGISTERED AGENT, INDIVIDUAL WITH DIRECT
// KNOWLEDGE, MANAGER, ...) — so mapOregonFilings groups them into one lead per
// business. Uniquely among these feeds, OR publishes the filer's first/last
// name directly.

export const OR_DATASET_URL = 'https://data.oregon.gov/resource/esjy-u4fc.json';

// Domestic entity types representing brand-new in-state formations (excludes
// "ASSUMED BUSINESS NAME" — a DBA registration, not a new entity — and
// "FOREIGN *" entities registering to do business in OR from elsewhere).
export const OR_NEW_ENTITY_TYPES = [
  'DOMESTIC LIMITED LIABILITY COMPANY',
  'DOMESTIC BUSINESS CORPORATION',
  'DOMESTIC NONPROFIT CORPORATION',
  'DOMESTIC PROFESSIONAL CORPORATION',
  'DOMESTIC LIMITED PARTNERSHIP',
  'DOMESTIC REGISTERED LIMITED LIABILITY PARTNERSHIP',
  'COOPERATIVE',
] as const;

// associated_name_type rows that may identify the filer, checked in priority order.
const OR_OWNER_ASSOCIATIONS = [
  'INDIVIDUAL WITH DIRECT KNOWLEDGE',
  'MEMBER',
  'MANAGER',
  'PRESIDENT',
  'REGISTRANT',
  'AUTHORIZED REPRESENTATIVE',
  'GENERAL PARTNER',
  'PARTNER',
] as const;

export interface OrFilingRow {
  registry_number?: string;
  business_name?: string;
  entity_type?: string;
  registry_date?: string;
  associated_name_type?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  entity_of_record_name?: string;
  address_?: string;
  address_continued?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

function orPersonName(row: OrFilingRow | undefined): string | null {
  if (!row) return null;
  const parts = [row.first_name, row.middle_name, row.last_name, row.suffix]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.length ? maybeTitleCase(parts.join(' ')) : null;
}

function orAddress(row: OrFilingRow | undefined): string | null {
  if (!row) return null;
  const stateZip = [row.state?.trim(), row.zip_code?.trim()].filter(Boolean).join(' ');
  const line1 = [row.address_?.trim(), row.address_continued?.trim()].filter(Boolean).join(' ');
  const city = row.city ? maybeTitleCase(row.city) : null;
  const parts = [line1 ? maybeTitleCase(line1) : null, city, stateZip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// Groups raw rows by registry_number (one row per associated_name_type) into
// one lead per business — Oregon's only multi-row state feed.
export function mapOregonFilings(rows: OrFilingRow[]): StateFilingLead[] {
  const groups = new Map<string, OrFilingRow[]>();
  for (const row of rows) {
    if (!row.registry_number) continue;
    const list = groups.get(row.registry_number);
    if (list) list.push(row); else groups.set(row.registry_number, [row]);
  }

  const leads: StateFilingLead[] = [];
  for (const [registryNumber, group] of groups) {
    const first = group[0];
    if (!first.business_name) continue;
    if (!(OR_NEW_ENTITY_TYPES as readonly string[]).includes(first.entity_type ?? '')) continue;

    const byType = (type: string) => group.find((r) => r.associated_name_type === type);
    const ownerRow = OR_OWNER_ASSOCIATIONS.map(byType).find((r) => orPersonName(r));
    const agentRow = byType('REGISTERED AGENT');
    const addressRow = byType('PRINCIPAL PLACE OF BUSINESS') ?? byType('MAILING ADDRESS');

    leads.push({
      business_name: maybeTitleCase(first.business_name),
      entity_type: normalizeEntityType(first.entity_type ?? null),
      state: 'OR',
      filing_date: first.registry_date ? first.registry_date.slice(0, 10) : null,
      registered_agent: agentRow?.entity_of_record_name ? maybeTitleCase(agentRow.entity_of_record_name) : orPersonName(agentRow),
      owner_name: orPersonName(ownerRow),
      address: orAddress(addressRow),
      industry: null,
      source_ref: `or-sos:${registryNumber}`,
    });
  }
  return leads;
}

// ── Pennsylvania — Dept. of State "Registered Businesses in PA Current" ─────
// https://data.pa.gov/resource/xvd7-5r2c.json — free, no API key, one row per
// business with its Organizer/Incorporator's first/middle/last name attached.
// `creationdate` is the formation date; `typeofbusinessregistration`
// distinguishes brand-new domestic formations from foreign qualifications.

export const PA_DATASET_URL = 'https://data.pa.gov/resource/xvd7-5r2c.json';

// Domestic registration types representing brand-new in-state formations
// (excludes "Foreign *" entities registering to do business in PA).
export const PA_NEW_ENTITY_TYPES = [
  'Domestic Limited Liability Company',
  'Domestic Business Corporation',
  'Domestic Nonprofit Corporation',
  'Domestic Limited Partnership (LP/LLLP)',
  'Domestic Business Trust',
  'Domestic General Partnership (GP/LLP)',
] as const;

export interface PaFilingRow {
  business_name?: string;
  filing_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  typeofbusinessregistration?: string;
  creationdate?: string;
  party_type?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
}

function paOwnerName(row: PaFilingRow): string | null {
  const parts = [row.first_name, row.middle_name, row.last_name]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.length ? maybeTitleCase(parts.join(' ')) : null;
}

function paAddress(row: PaFilingRow): string | null {
  const stateZip = [row.state?.trim(), row.zip?.trim()].filter(Boolean).join(' ');
  const line1 = [row.address_line1?.trim(), row.address_line2?.trim()].filter(Boolean).join(' ');
  const city = row.city?.trim();
  const parts = [line1 || null, city || null, stateZip || null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function mapPaFiling(row: PaFilingRow): StateFilingLead {
  return {
    business_name: maybeTitleCase(row.business_name ?? ''),
    entity_type: normalizeEntityType(row.typeofbusinessregistration ?? null),
    state: 'PA',
    filing_date: row.creationdate ? row.creationdate.slice(0, 10) : null,
    owner_name: paOwnerName(row),
    address: paAddress(row),
    industry: null,
    source_ref: row.filing_number ? `pa-dos:${row.filing_number}` : undefined,
  };
}

// ── Connecticut — Secretary of State "Business Registry - Business Master" ──
// https://data.ct.gov/resource/n7gp-d28j.json — free, no API key, updated
// daily. Uniquely among these feeds, CT publishes the registrant's email
// address (`business_email_address`) directly, so most CT leads arrive with
// an email already attached — no AI enrichment needed.

export const CT_DATASET_URL = 'https://data.ct.gov/resource/n7gp-d28j.json';

// `business_type` values representing brand-new domestic formations (not
// reservations, mergers, or financial-institution charters).
export const CT_NEW_ENTITY_TYPES = ['LLC', 'Stock', 'Non-Stock', 'Limited Partnership', 'LLP', 'B Corp'] as const;

const CT_ENTITY_TYPE_LABELS: Record<string, string> = {
  LLC: 'LLC',
  Stock: 'Corporation',
  'Non-Stock': 'Nonprofit',
  'Limited Partnership': 'Limited Partnership',
  LLP: 'LLP',
  'B Corp': 'Corporation',
};

export interface CtFilingRow {
  name?: string;
  business_type?: string;
  status?: string;
  accountnumber?: string;
  date_registration?: string;
  billingstreet?: string;
  billingcity?: string;
  billingstate?: string;
  billingpostalcode?: string;
  business_email_address?: string;
  category_survey_email_address?: string;
  naics_code?: string;
}

function ctAddress(row: CtFilingRow): string | null {
  const stateZip = [row.billingstate?.trim(), row.billingpostalcode?.trim()].filter(Boolean).join(' ');
  const street = row.billingstreet?.trim();
  const city = row.billingcity ? maybeTitleCase(row.billingcity.trim()) : null;
  const parts = [street || null, city, stateZip || null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function mapConnecticutFiling(row: CtFilingRow): StateFilingLead {
  return {
    business_name: maybeTitleCase(row.name ?? ''),
    entity_type: normalizeEntityType(CT_ENTITY_TYPE_LABELS[row.business_type ?? ''] ?? row.business_type ?? null),
    state: 'CT',
    filing_date: row.date_registration ? row.date_registration.slice(0, 10) : null,
    filing_status: row.status ?? null,
    address: ctAddress(row),
    industry: row.naics_code ?? null,
    email: row.business_email_address || row.category_survey_email_address || null,
    source_ref: row.accountnumber ? `ct-sos:${row.accountnumber}` : undefined,
  };
}

// ── Texas — Comptroller "Active Sales Tax Permit Holders" ────────────────────
// https://data.texas.gov/resource/jrea-zgmq.json — free, no API key, ~1M rows,
// refreshed regularly with a roughly week-long publishing lag. Texas doesn't
// publish a Secretary-of-State entity-formation feed as open data, so this
// dataset is used as a proxy: a brand-new sales-tax permit is a strong signal
// of a newly-operating business. `taxpayer_organization_type` distinguishes
// for-profit entities (LLC/Corp/Professional Corp/Professional Assoc/LP) from
// sole proprietors (individuals — excluded for privacy/lead-quality reasons),
// out-of-state corporations registering to do business in TX (often large
// existing companies, e.g. Walmart), and nonprofits/schools/municipalities.

export const TX_DATASET_URL = 'https://data.texas.gov/resource/jrea-zgmq.json';

// taxpayer_organization_type codes representing in-state for-profit entities
// (excludes IS "individual/sole proprietor", CI/CF "out-of-state corporation",
// and CN/AR/GS/GC "nonprofit/association/government").
export const TX_NEW_ENTITY_TYPES = ['CL', 'CT', 'CP', 'AP', 'PL'] as const;

const TX_ORG_TYPE_LABELS: Record<string, string> = {
  CL: 'LLC',
  CT: 'Corporation',
  CP: 'Professional Corporation',
  AP: 'Professional Association',
  PL: 'Limited Partnership',
};

export interface TxFilingRow {
  taxpayer_number?: string;
  taxpayer_name?: string;
  taxpayer_address?: string;
  taxpayer_city?: string;
  taxpayer_state?: string;
  taxpayer_zip_code?: string;
  taxpayer_organization_type?: string;
  outlet_naics_code?: string;
  outlet_permit_issue_date?: string;
}

function txAddress(row: TxFilingRow): string | null {
  const stateZip = [row.taxpayer_state?.trim(), row.taxpayer_zip_code?.trim()].filter(Boolean).join(' ');
  const street = row.taxpayer_address?.trim();
  const city = row.taxpayer_city ? maybeTitleCase(row.taxpayer_city.trim()) : null;
  const parts = [street || null, city, stateZip || null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function mapTexasFiling(row: TxFilingRow): StateFilingLead {
  return {
    business_name: maybeTitleCase(row.taxpayer_name ?? ''),
    entity_type: normalizeEntityType(TX_ORG_TYPE_LABELS[row.taxpayer_organization_type ?? ''] ?? row.taxpayer_organization_type ?? null),
    state: 'TX',
    filing_date: row.outlet_permit_issue_date ? row.outlet_permit_issue_date.slice(0, 10) : null,
    filing_status: 'Active',
    address: txAddress(row),
    industry: row.outlet_naics_code ?? null,
    source_ref: row.taxpayer_number ? `tx-comptroller:${row.taxpayer_number}` : undefined,
  };
}

// ── California (San Francisco) — "Registered Business Locations" ───────────
// https://data.sfgov.org/resource/g8m3-pdis.json — free, no API key, updated
// daily. California's Secretary of State does not publish a free open-data
// feed of new entity filings, so San Francisco's business-registration tax
// certificate data (which covers any business operating in or mailing from
// SF, including statewide LLCs/corporations) is used as a CA proxy.
// `ownership_name` is either a registered entity (LLC/Corp/etc — detected via
// suffix) or an individual's name (sole proprietor); `sfEntityType()`
// distinguishes the two so both `entity_type` and `owner_name` (a real first
// + last name for sole proprietors) can be populated from one field.

export const SF_DATASET_URL = 'https://data.sfgov.org/resource/g8m3-pdis.json';

export interface SfFilingRow {
  ttxid?: string;
  ownership_name?: string;
  dba_name?: string;
  full_business_address?: string;
  city?: string;
  state?: string;
  business_zip?: string;
  dba_start_date?: string;
  naic_code_description?: string;
}

// Detects a registered-entity suffix on `ownership_name` (e.g. "185 Cb, LLC",
// "Belkorp Ag LLC", "XYZ Partners, L.P."). Returns null when the name looks
// like an individual's (sole proprietor).
function sfEntityType(ownershipName: string): string | null {
  const name = ownershipName.trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes('limited liability company') || /\bl\.?\s?l\.?\s?c\.?$/.test(lower)) return 'LLC';
  if (lower.includes('limited liability partnership') || /\bl\.?\s?l\.?\s?p\.?$/.test(lower)) return 'LLP';
  if (lower.includes('limited partnership') || /\bl\.?\s?p\.?$/.test(lower)) return 'Limited Partnership';
  if (/\b(?:incorporated|inc|corp(?:oration)?)\.?$/.test(lower)) return 'Corporation';
  if (/\bp\.?c\.?$/.test(lower)) return 'Professional Corporation';
  return null;
}

function sfAddress(row: SfFilingRow): string | null {
  const stateZip = [row.state?.trim(), row.business_zip?.trim()].filter(Boolean).join(' ');
  const street = row.full_business_address?.trim();
  const city = row.city ? maybeTitleCase(row.city.trim()) : null;
  const parts = [street || null, city, stateZip || null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function mapSanFranciscoFiling(row: SfFilingRow): StateFilingLead {
  const ownership = (row.ownership_name ?? '').trim();
  const dba = (row.dba_name ?? '').trim();
  const entityType = sfEntityType(ownership);
  return {
    business_name: maybeTitleCase(dba || ownership),
    entity_type: entityType,
    state: 'CA',
    filing_date: row.dba_start_date ? row.dba_start_date.slice(0, 10) : null,
    filing_status: 'Active',
    owner_name: entityType ? null : (maybeTitleCase(ownership) || null),
    address: sfAddress(row),
    industry: row.naic_code_description ?? null,
    source_ref: row.ttxid ? `sf-business:${row.ttxid}` : undefined,
  };
}

// ── Registry of available free state feeds ──────────────────────────────────
// Single source of truth for both server-side validation (ingest route) and
// the admin UI's state picker. Add an entry here + a fetch+map implementation
// in the ingest route to bring a new state online.

export const STATE_FEED_SOURCES = {
  NY: {
    label: 'New York — Dept. of State',
    description: 'New LLC (Articles of Organization) and corporation (Certificate of Incorporation) filings from NY DOS open data. Free, no API key, updated daily (with a short publishing lag).',
  },
  CO: {
    label: 'Colorado — Secretary of State',
    description: 'New domestic LLC, corporation, and nonprofit formations from the Colorado Business Entities open dataset. Free, no API key, updated regularly.',
  },
  FL: {
    label: 'Florida — Division of Corporations (Sunbiz)',
    description: 'New domestic LLC, profit, and non-profit corporation filings from Sunbiz’s daily corporate data file. Free (public SFTP credentials), updated daily.',
  },
  OR: {
    label: 'Oregon — Secretary of State',
    description: 'New domestic LLC, corporation, nonprofit, and partnership registrations from the Oregon Business Registry open dataset — includes the filer’s first and last name. Free, no API key, refreshed monthly.',
  },
  PA: {
    label: 'Pennsylvania — Dept. of State',
    description: 'New domestic LLC, corporation, nonprofit, and partnership registrations from the PA Registered Businesses open dataset, including the Organizer/Incorporator’s first and last name. Free, no API key, updated regularly.',
  },
  CT: {
    label: 'Connecticut — Secretary of State',
    description: 'New domestic LLC, corporation, nonprofit, and partnership registrations from the CT Business Registry Master open dataset — uniquely includes the registrant’s email address directly. Free, no API key, updated daily.',
  },
  TX: {
    label: 'Texas — Comptroller (Sales Tax Permits)',
    description: 'Newly-issued sales tax permits for LLCs, corporations, professional corporations/associations, and limited partnerships from the Texas Comptroller open dataset — used as a proxy for new business activity. Free, no API key.',
  },
  CA: {
    label: 'California — San Francisco Registered Businesses',
    description: 'Newly-registered business locations from San Francisco’s business tax certificate open dataset, used as a proxy for new CA business activity — includes the owner’s first and last name for sole proprietorships. Free, no API key, updated daily.',
  },
} as const;

export type StateFeedCode = keyof typeof STATE_FEED_SOURCES;
