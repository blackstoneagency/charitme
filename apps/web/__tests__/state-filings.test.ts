import { describe, expect, it } from 'vitest';
import {
  mapNyFiling,
  titleCaseBusinessName,
  NY_NEW_ENTITY_DOC_TYPES,
  STATE_FEED_SOURCES,
  type NyFilingRow,
} from '../lib/state-filings';

// This suite exercises the pure mapping layer for free state-registry feeds —
// the ingest route's fetch functions call these with live API rows, so green
// here means a connector's data will normalize correctly into BusinessLeadInput.

describe('titleCaseBusinessName', () => {
  it('title-cases ALL CAPS names while preserving entity-type suffixes', () => {
    expect(titleCaseBusinessName('CHIAPPERINO LLC')).toBe('Chiapperino LLC');
    expect(titleCaseBusinessName('STOCKADE ASPHALT SERVICES LLC')).toBe('Stockade Asphalt Services LLC');
    expect(titleCaseBusinessName('FRONT PETRO INC.')).toBe('Front Petro INC.');
  });

  it('collapses extra whitespace', () => {
    expect(titleCaseBusinessName('  RIVERSIDE   FOUNDATION  ')).toBe('Riverside Foundation');
  });
});

describe('mapNyFiling', () => {
  const baseRow: NyFilingRow = {
    corpid_num: '7938482',
    corp_name: 'CHIAPPERINO LLC',
    entitytype: 'DOMESTIC LIMITED LIABILITY COMPANY',
    documenttype: 'ARTICLES OF ORGANIZATION',
    date_filed: '2026-06-09T00:00:00.000',
    cnty_prin_ofc: 'Kings',
    nfp_type: 'NO-ANSWER',
  };

  it('maps a domestic LLC filing to a BusinessLeadInput', () => {
    const lead = mapNyFiling(baseRow);
    expect(lead.business_name).toBe('Chiapperino LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('NY');
    expect(lead.filing_date).toBe('2026-06-09');
    expect(lead.filing_status).toBe('ARTICLES OF ORGANIZATION');
    expect(lead.address).toBe('Kings County, NY');
    expect(lead.industry).toBeNull();
    expect(lead.source_ref).toBe('ny-dos:7938482');
  });

  it('maps a domestic corporation filing', () => {
    const lead = mapNyFiling({
      ...baseRow,
      corp_name: 'FRONT PETRO INC.',
      entitytype: 'DOMESTIC BUSINESS CORPORATION',
      documenttype: 'CERTIFICATE OF INCORPORATION',
    });
    expect(lead.business_name).toBe('Front Petro INC.');
    expect(lead.entity_type).toBe('Corporation');
  });

  it('carries through a real nonprofit category, dropping placeholder values', () => {
    const withNfp = mapNyFiling({ ...baseRow, nfp_type: 'CHARITABLE' });
    expect(withNfp.industry).toBe('CHARITABLE');

    for (const placeholder of ['NO-ANSWER', 'NOT APPLICABLE', '', undefined]) {
      expect(mapNyFiling({ ...baseRow, nfp_type: placeholder }).industry).toBeNull();
    }
  });

  it('handles missing county and corpid gracefully', () => {
    const lead = mapNyFiling({ corp_name: 'BARE LLC', entitytype: 'DOMESTIC LIMITED LIABILITY COMPANY' });
    expect(lead.address).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('STATE_FEED_SOURCES / NY_NEW_ENTITY_DOC_TYPES', () => {
  it('registers the New York feed with a label', () => {
    expect(STATE_FEED_SOURCES.NY.label).toMatch(/New York/);
  });

  it('targets only brand-new entity formation document types', () => {
    expect(NY_NEW_ENTITY_DOC_TYPES).toEqual(['ARTICLES OF ORGANIZATION', 'CERTIFICATE OF INCORPORATION']);
  });
});
