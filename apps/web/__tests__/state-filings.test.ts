import { describe, expect, it } from 'vitest';
import {
  mapNyFiling,
  mapCoFiling,
  titleCaseBusinessName,
  maybeTitleCase,
  NY_NEW_ENTITY_DOC_TYPES,
  CO_NEW_ENTITY_TYPES,
  STATE_FEED_SOURCES,
  type NyFilingRow,
  type CoFilingRow,
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

  it('keeps standalone Roman numerals upper-cased', () => {
    expect(titleCaseBusinessName('ASSOCIATES III, INC.')).toBe('Associates III, INC.');
    expect(titleCaseBusinessName('PHASE IV HOLDINGS LLC')).toBe('Phase IV Holdings LLC');
  });
});

describe('maybeTitleCase', () => {
  it('title-cases names that are entirely SHOUTING', () => {
    expect(maybeTitleCase('SETTLE QUANTUMEX LLC')).toBe('Settle Quantumex LLC');
  });

  it('leaves already mixed-case names (and acronyms) untouched', () => {
    expect(maybeTitleCase('TLC Consulting Limited')).toBe('TLC Consulting Limited');
    expect(maybeTitleCase('Party Boss, LLC')).toBe('Party Boss, LLC');
  });

  it('collapses extra whitespace either way', () => {
    expect(maybeTitleCase('  Acme   Holdings  ')).toBe('Acme Holdings');
    expect(maybeTitleCase('  ACME   HOLDINGS  ')).toBe('Acme Holdings');
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

describe('mapCoFiling', () => {
  const baseRow: CoFilingRow = {
    entityid: '20261714629',
    entityname: 'SETTLE QUANTUMEX LLC',
    entitytype: 'DLLC',
    entitystatus: 'Good Standing',
    entityformdate: '2026-06-11T00:00:00.000',
    principaladdress1: '3922 Kalamath St',
    principalcity: 'Denver',
    principalstate: 'CO',
    principalzipcode: '80211',
    agentfirstname: 'RYAN',
    agentmiddlename: 'PAUL',
    agentlastname: 'ANDREW',
  };

  it('maps a domestic LLC filing to a BusinessLeadInput', () => {
    const lead = mapCoFiling(baseRow);
    expect(lead.business_name).toBe('Settle Quantumex LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('CO');
    expect(lead.filing_date).toBe('2026-06-11');
    expect(lead.filing_status).toBe('Good Standing');
    expect(lead.registered_agent).toBe('RYAN PAUL ANDREW');
    expect(lead.address).toBe('3922 Kalamath St, Denver, CO 80211');
    expect(lead.industry).toBeNull();
    expect(lead.source_ref).toBe('co-sos:20261714629');
  });

  it('maps a domestic profit corporation filing', () => {
    const lead = mapCoFiling({ ...baseRow, entityname: 'ASSOCIATES III, INC.', entitytype: 'DPC' });
    expect(lead.business_name).toBe('Associates III, INC.');
    expect(lead.entity_type).toBe('Corporation');
  });

  it('maps a domestic nonprofit corporation filing', () => {
    const lead = mapCoFiling({ ...baseRow, entityname: 'ROCK RIDGE CONDOMINIUMS, INC.', entitytype: 'DNC' });
    expect(lead.entity_type).toBe('Nonprofit');
  });

  it('prefers an organization registered agent over an individual name', () => {
    const lead = mapCoFiling({
      ...baseRow,
      agentorganizationname: 'C T CORPORATION SYSTEM',
    });
    expect(lead.registered_agent).toBe('C T CORPORATION SYSTEM');
  });

  it('handles missing address, agent, and entityid gracefully', () => {
    const lead = mapCoFiling({ entityname: 'BARE LLC', entitytype: 'DLLC' });
    expect(lead.address).toBeNull();
    expect(lead.registered_agent).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('STATE_FEED_SOURCES / NY_NEW_ENTITY_DOC_TYPES / CO_NEW_ENTITY_TYPES', () => {
  it('registers the New York and Colorado feeds with labels', () => {
    expect(STATE_FEED_SOURCES.NY.label).toMatch(/New York/);
    expect(STATE_FEED_SOURCES.CO.label).toMatch(/Colorado/);
  });

  it('targets only brand-new entity formation document types', () => {
    expect(NY_NEW_ENTITY_DOC_TYPES).toEqual(['ARTICLES OF ORGANIZATION', 'CERTIFICATE OF INCORPORATION']);
    expect(CO_NEW_ENTITY_TYPES).toEqual(['DLLC', 'DPC', 'DNC']);
  });
});
