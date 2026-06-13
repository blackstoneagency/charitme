import { describe, expect, it } from 'vitest';
import {
  mapNyFiling,
  mapCoFiling,
  mapFlFiling,
  mapOregonFilings,
  mapPaFiling,
  mapConnecticutFiling,
  parseFlCorLine,
  parseFlDate,
  titleCaseBusinessName,
  maybeTitleCase,
  NY_NEW_ENTITY_DOC_TYPES,
  CO_NEW_ENTITY_TYPES,
  FL_NEW_ENTITY_FILING_TYPES,
  OR_NEW_ENTITY_TYPES,
  PA_NEW_ENTITY_TYPES,
  CT_NEW_ENTITY_TYPES,
  STATE_FEED_SOURCES,
  type NyFilingRow,
  type CoFilingRow,
  type OrFilingRow,
  type PaFilingRow,
  type CtFilingRow,
} from '../lib/state-filings';

// Builds a fixed-width Sunbiz cor.txt record by placing fields at the
// documented 0-indexed byte ranges (see lib/state-filings.ts), padding the
// rest with spaces — mirrors the real file format closely enough to exercise
// parseFlCorLine's slicing logic.
function buildFlCorLine(fields: {
  corporationNumber?: string;
  corporationName?: string;
  status?: string;
  filingType?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  fileDate?: string;
  registeredAgentName?: string;
}, length = 1440): string {
  const chars = new Array(length).fill(' ');
  const place = (value: string | undefined, start: number, len: number) => {
    if (!value) return;
    for (let i = 0; i < Math.min(value.length, len); i++) chars[start + i] = value[i];
  };
  place(fields.corporationNumber, 0, 12);
  place(fields.corporationName, 12, 192);
  place(fields.status, 204, 1);
  place(fields.filingType, 205, 15);
  place(fields.addressLine1, 220, 42);
  place(fields.city, 304, 28);
  place(fields.state, 332, 2);
  place(fields.zip, 334, 10);
  place(fields.fileDate, 472, 8);
  place(fields.registeredAgentName, 544, 42);
  return chars.join('');
}

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

describe('parseFlDate', () => {
  it('converts CCYYMMDD to YYYY-MM-DD', () => {
    expect(parseFlDate('20260612')).toBe('2026-06-12');
  });

  it('returns null for non-8-digit or implausible dates', () => {
    expect(parseFlDate('2026612')).toBeNull();
    expect(parseFlDate('abcdefgh')).toBeNull();
    expect(parseFlDate('00000000')).toBeNull();
    expect(parseFlDate('20269999')).toBeNull();
  });
});

describe('parseFlCorLine / mapFlFiling', () => {
  const llcLine = buildFlCorLine({
    corporationNumber: 'L26000123456',
    corporationName: 'ACME VENTURES LLC',
    status: 'A',
    filingType: 'FLAL',
    addressLine1: '100 BISCAYNE BLVD',
    city: 'MIAMI',
    state: 'FL',
    zip: '33131',
    fileDate: '20260612',
    registeredAgentName: 'CT CORPORATION SYSTEM',
  });

  it('parses fixed-width fields at their documented byte positions', () => {
    const row = parseFlCorLine(llcLine);
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      corporationNumber: 'L26000123456',
      corporationName: 'ACME VENTURES LLC',
      status: 'A',
      filingType: 'FLAL',
      addressLine1: '100 BISCAYNE BLVD',
      city: 'MIAMI',
      state: 'FL',
      zip: '33131',
      fileDate: '2026-06-12',
      registeredAgentName: 'CT CORPORATION SYSTEM',
    });
  });

  it('maps a Florida LLC filing to a BusinessLeadInput', () => {
    const lead = mapFlFiling(parseFlCorLine(llcLine)!);
    expect(lead.business_name).toBe('Acme Ventures LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('FL');
    expect(lead.filing_date).toBe('2026-06-12');
    expect(lead.filing_status).toBe('Active');
    expect(lead.registered_agent).toBe('CT CORPORATION SYSTEM');
    expect(lead.address).toBe('100 Biscayne Blvd, Miami, FL 33131');
    expect(lead.source_ref).toBe('fl-sunbiz:L26000123456');
  });

  it('maps a domestic profit corporation filing', () => {
    const corpLine = buildFlCorLine({ corporationNumber: 'P26000999999', corporationName: 'RIVERSIDE HOLDINGS INC', status: 'A', filingType: 'DOMP', fileDate: '20260612' });
    expect(mapFlFiling(parseFlCorLine(corpLine)!).entity_type).toBe('Corporation');
  });

  it('maps a domestic non-profit corporation filing', () => {
    const npLine = buildFlCorLine({ corporationNumber: 'N26000111111', corporationName: 'RIVERSIDE COMMUNITY FOUNDATION INC', status: 'A', filingType: 'DOMNP', fileDate: '20260612' });
    expect(mapFlFiling(parseFlCorLine(npLine)!).entity_type).toBe('Nonprofit');
  });

  it('maps inactive status and falls back to the raw code for unknown statuses', () => {
    const inactive = buildFlCorLine({ ...{ corporationName: 'OLD CO LLC', filingType: 'FLAL' }, status: 'I' });
    expect(mapFlFiling(parseFlCorLine(inactive)!).filing_status).toBe('Inactive');

    const unknown = buildFlCorLine({ corporationName: 'WEIRD CO LLC', filingType: 'FLAL', status: 'X' });
    expect(mapFlFiling(parseFlCorLine(unknown)!).filing_status).toBe('X');
  });

  it('returns null for lines shorter than the minimum field-readable length', () => {
    expect(parseFlCorLine('too short')).toBeNull();
  });

  it('returns a null filing_date for a malformed File Date field', () => {
    const badDate = buildFlCorLine({ corporationName: 'NO DATE LLC', filingType: 'FLAL', status: 'A', fileDate: '????????' });
    expect(parseFlCorLine(badDate)!.fileDate).toBeNull();
  });

  it('handles a missing address/registered agent gracefully', () => {
    const bare = buildFlCorLine({ corporationNumber: 'L26000000001', corporationName: 'BARE LLC', status: 'A', filingType: 'FLAL', fileDate: '20260612' });
    const lead = mapFlFiling(parseFlCorLine(bare)!);
    expect(lead.address).toBeNull();
    expect(lead.registered_agent).toBeNull();
  });
});

describe('mapOregonFilings', () => {
  // Mirrors a real registry_number group from data.oregon.gov/resource/esjy-u4fc:
  // one row per associated_name_type, all sharing business_name/entity_type/registry_date.
  const baseGroup: OrFilingRow[] = [
    {
      registry_number: '257459397',
      business_name: 'FINANCEGOALZ LLC',
      entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY',
      registry_date: '2026-05-29T16:53:25.000',
      associated_name_type: 'INDIVIDUAL WITH DIRECT KNOWLEDGE',
      first_name: 'DANIELLE',
      last_name: 'DUNCAN',
      address_: '1300 SW PARK AVE',
      city: 'PORTLAND',
      state: 'OR',
      zip_code: '97201',
    },
    {
      registry_number: '257459397',
      business_name: 'FINANCEGOALZ LLC',
      entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY',
      registry_date: '2026-05-29T16:53:25.000',
      associated_name_type: 'MAILING ADDRESS',
      address_: '1300 SW PARK AVE',
      address_continued: 'SUITE 1301',
      city: 'PORTLAND',
      state: 'OR',
      zip_code: '97201',
    },
    {
      registry_number: '257459397',
      business_name: 'FINANCEGOALZ LLC',
      entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY',
      registry_date: '2026-05-29T16:53:25.000',
      associated_name_type: 'PRINCIPAL PLACE OF BUSINESS',
      address_: '1300 SW PARK AVE',
      city: 'PORTLAND',
      state: 'OR',
      zip_code: '97201',
    },
    {
      registry_number: '257459397',
      business_name: 'FINANCEGOALZ LLC',
      entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY',
      registry_date: '2026-05-29T16:53:25.000',
      associated_name_type: 'REGISTERED AGENT',
      first_name: 'DANIELLE',
      last_name: 'DUNCAN',
      address_: '1300 SW PARK AVE',
      city: 'PORTLAND',
      state: 'OR',
      zip_code: '97201',
    },
  ];

  it('groups multi-row registry data into one lead with owner first/last name', () => {
    const [lead] = mapOregonFilings(baseGroup);
    expect(lead.business_name).toBe('Financegoalz LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('OR');
    expect(lead.filing_date).toBe('2026-05-29');
    expect(lead.owner_name).toBe('Danielle Duncan');
    expect(lead.registered_agent).toBe('Danielle Duncan');
    expect(lead.address).toBe('1300 Sw Park Ave, Portland, OR 97201');
    expect(lead.source_ref).toBe('or-sos:257459397');
  });

  it('prefers an organization registered agent over an individual name', () => {
    const withOrgAgent: OrFilingRow[] = [
      ...baseGroup.filter((r) => r.associated_name_type !== 'REGISTERED AGENT'),
      {
        registry_number: '257459397',
        business_name: 'FINANCEGOALZ LLC',
        entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY',
        registry_date: '2026-05-29T16:53:25.000',
        associated_name_type: 'REGISTERED AGENT',
        entity_of_record_name: '1 OFFICE SOLUTIONS LLC',
        address_: '1055 NE MOE LN',
        city: 'HERMISTON',
        state: 'OR',
        zip_code: '97838',
      },
    ];
    expect(mapOregonFilings(withOrgAgent)[0].registered_agent).toBe('1 Office Solutions LLC');
  });

  it('falls back to MAILING ADDRESS when no PRINCIPAL PLACE OF BUSINESS row exists', () => {
    const noPrincipal = baseGroup.filter((r) => r.associated_name_type !== 'PRINCIPAL PLACE OF BUSINESS');
    expect(mapOregonFilings(noPrincipal)[0].address).toBe('1300 Sw Park Ave Suite 1301, Portland, OR 97201');
  });

  it('skips groups missing a business name or not a new-entity type', () => {
    expect(mapOregonFilings([{ registry_number: '1', entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY' }])).toEqual([]);
    expect(mapOregonFilings([{ registry_number: '2', business_name: 'OLD CO LLC', entity_type: 'ASSUMED BUSINESS NAME' }])).toEqual([]);
  });

  it('ignores rows with no registry_number', () => {
    expect(mapOregonFilings([{ business_name: 'NO ID LLC', entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY' }])).toEqual([]);
  });
});

describe('mapPaFiling', () => {
  const baseRow: PaFilingRow = {
    business_name: "Marberger's Contractors Llc",
    filing_number: '0014681149',
    address_line1: '3075 Horseshoe Pike',
    city: 'Honey Brook',
    state: 'PA',
    zip: '19344-8656',
    typeofbusinessregistration: 'Domestic Limited Liability Company',
    creationdate: '2025-07-30T00:00:00.000',
    party_type: 'Organizer',
    first_name: 'Curtis',
    last_name: 'Marberger',
  };

  it('maps a domestic LLC filing, preserving already-correct casing', () => {
    const lead = mapPaFiling(baseRow);
    expect(lead.business_name).toBe("Marberger's Contractors Llc");
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('PA');
    expect(lead.filing_date).toBe('2025-07-30');
    expect(lead.owner_name).toBe('Curtis Marberger');
    expect(lead.address).toBe('3075 Horseshoe Pike, Honey Brook, PA 19344-8656');
    expect(lead.source_ref).toBe('pa-dos:0014681149');
  });

  it('maps a domestic corporation filing', () => {
    const lead = mapPaFiling({ ...baseRow, business_name: 'RIVERSIDE HOLDINGS INC', typeofbusinessregistration: 'Domestic Business Corporation' });
    expect(lead.business_name).toBe('Riverside Holdings INC');
    expect(lead.entity_type).toBe('Corporation');
  });

  it('maps a domestic nonprofit corporation filing', () => {
    const lead = mapPaFiling({ ...baseRow, typeofbusinessregistration: 'Domestic Nonprofit Corporation' });
    expect(lead.entity_type).toBe('Nonprofit');
  });

  it('includes a middle name when present', () => {
    const lead = mapPaFiling({ ...baseRow, middle_name: 'James' });
    expect(lead.owner_name).toBe('Curtis James Marberger');
  });

  it('handles missing owner name, address, and filing number gracefully', () => {
    const lead = mapPaFiling({ business_name: 'BARE LLC', typeofbusinessregistration: 'Domestic Limited Liability Company' });
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('mapConnecticutFiling', () => {
  const baseRow: CtFilingRow = {
    name: 'Nutmeg Accounting LLC',
    business_type: 'LLC',
    status: 'Active',
    accountnumber: '3460640',
    date_registration: '2026-06-11T00:00:00.000',
    billingstreet: '16 Farm Field Ridge Rd',
    billingcity: 'Sandy Hook',
    billingstate: 'CT',
    billingpostalcode: '06482-1081',
    business_email_address: 'sahmed@nutmegaccountingllc.com',
    naics_code: 'Other Accounting Services (541219)',
  };

  it('maps a domestic LLC filing, including the registrant email', () => {
    const lead = mapConnecticutFiling(baseRow);
    expect(lead.business_name).toBe('Nutmeg Accounting LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('CT');
    expect(lead.filing_date).toBe('2026-06-11');
    expect(lead.filing_status).toBe('Active');
    expect(lead.email).toBe('sahmed@nutmegaccountingllc.com');
    expect(lead.industry).toBe('Other Accounting Services (541219)');
    expect(lead.address).toBe('16 Farm Field Ridge Rd, Sandy Hook, CT 06482-1081');
    expect(lead.source_ref).toBe('ct-sos:3460640');
  });

  it('maps Stock and Non-Stock business types to Corporation and Nonprofit', () => {
    expect(mapConnecticutFiling({ ...baseRow, business_type: 'Stock' }).entity_type).toBe('Corporation');
    expect(mapConnecticutFiling({ ...baseRow, business_type: 'Non-Stock' }).entity_type).toBe('Nonprofit');
  });

  it('title-cases an ALL CAPS business name and city, preserving the LLC suffix', () => {
    const lead = mapConnecticutFiling({
      ...baseRow,
      name: 'MORALES MEZA PAINTING LLC',
      billingcity: 'BRIDGEPORT',
    });
    expect(lead.business_name).toBe('Morales Meza Painting LLC');
    expect(lead.address).toBe('16 Farm Field Ridge Rd, Bridgeport, CT 06482-1081');
  });

  it('falls back to the diversity-survey email when business_email_address is missing', () => {
    const lead = mapConnecticutFiling({ ...baseRow, business_email_address: undefined, category_survey_email_address: 'fallback@example.com' });
    expect(lead.email).toBe('fallback@example.com');
  });

  it('handles missing email, address, and account number gracefully', () => {
    const lead = mapConnecticutFiling({ name: 'BARE LLC', business_type: 'LLC' });
    expect(lead.email).toBeNull();
    expect(lead.address).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('STATE_FEED_SOURCES / NY_NEW_ENTITY_DOC_TYPES / CO_NEW_ENTITY_TYPES / FL_NEW_ENTITY_FILING_TYPES / OR_NEW_ENTITY_TYPES / PA_NEW_ENTITY_TYPES / CT_NEW_ENTITY_TYPES', () => {
  it('registers the New York, Colorado, Florida, Oregon, Pennsylvania, and Connecticut feeds with labels', () => {
    expect(STATE_FEED_SOURCES.NY.label).toMatch(/New York/);
    expect(STATE_FEED_SOURCES.CO.label).toMatch(/Colorado/);
    expect(STATE_FEED_SOURCES.FL.label).toMatch(/Florida/);
    expect(STATE_FEED_SOURCES.OR.label).toMatch(/Oregon/);
    expect(STATE_FEED_SOURCES.PA.label).toMatch(/Pennsylvania/);
    expect(STATE_FEED_SOURCES.CT.label).toMatch(/Connecticut/);
  });

  it('targets only brand-new entity formation document/filing/entity types', () => {
    expect(NY_NEW_ENTITY_DOC_TYPES).toEqual(['ARTICLES OF ORGANIZATION', 'CERTIFICATE OF INCORPORATION']);
    expect(CO_NEW_ENTITY_TYPES).toEqual(['DLLC', 'DPC', 'DNC']);
    expect(FL_NEW_ENTITY_FILING_TYPES).toEqual(['DOMP', 'DOMNP', 'FLAL']);
    expect(OR_NEW_ENTITY_TYPES).toContain('DOMESTIC LIMITED LIABILITY COMPANY');
    expect(OR_NEW_ENTITY_TYPES).not.toContain('ASSUMED BUSINESS NAME');
    expect(PA_NEW_ENTITY_TYPES).toContain('Domestic Limited Liability Company');
    expect(PA_NEW_ENTITY_TYPES).not.toContain('Foreign Limited Liability Company');
    expect(CT_NEW_ENTITY_TYPES).toEqual(['LLC', 'Stock', 'Non-Stock', 'Limited Partnership', 'LLP', 'B Corp']);
  });
});
