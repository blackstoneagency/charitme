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

export function titleCaseBusinessName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const bare = word.replace(/[.,]/g, '').toUpperCase();
      if (KEEP_UPPERCASE.has(bare)) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
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

// ── Registry of available free state feeds ──────────────────────────────────
// Single source of truth for both server-side validation (ingest route) and
// the admin UI's state picker. Add an entry here + a fetch+map implementation
// in the ingest route to bring a new state online.

export const STATE_FEED_SOURCES = {
  NY: {
    label: 'New York — Dept. of State',
    description: 'New LLC (Articles of Organization) and corporation (Certificate of Incorporation) filings from NY DOS open data. Free, no API key, updated daily (with a short publishing lag).',
  },
} as const;

export type StateFeedCode = keyof typeof STATE_FEED_SOURCES;
