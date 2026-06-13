import { describe, expect, it } from 'vitest';
import {
  mapNyFiling,
  mapCoFiling,
  mapFlFiling,
  mapOregonFilings,
  mapPaFiling,
  mapConnecticutFiling,
  mapTexasFiling,
  mapSanFranciscoFiling,
  mapChicagoFiling,
  mapNorfolkFiling,
  mapWashingtonFiling,
  mapDelawareFiling,
  mapNewOrleansFiling,
  mapMesaFiling,
  mapBentonvilleFiling,
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
  TX_NEW_ENTITY_TYPES,
  STATE_FEED_SOURCES,
  type NyFilingRow,
  type CoFilingRow,
  type OrFilingRow,
  type PaFilingRow,
  type CtFilingRow,
  type TxFilingRow,
  type SfFilingRow,
  type ChicagoFilingRow,
  type NorfolkFilingRow,
  type WaFilingRow,
  type DeFilingRow,
  type NolaFilingRow,
  type MesaFilingRow,
  type BentonvilleFilingRow,
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

describe('mapTexasFiling', () => {
  const baseRow: TxFilingRow = {
    taxpayer_number: '32087458215',
    taxpayer_name: 'JO N GO LLC',
    taxpayer_address: '1340 SUNSET VW',
    taxpayer_city: 'FISCHER',
    taxpayer_state: 'TX',
    taxpayer_zip_code: '78623',
    taxpayer_organization_type: 'CL',
    outlet_naics_code: '722515',
    outlet_permit_issue_date: '2026-06-06T00:00:00.000',
  };

  it('maps a new LLC sales-tax-permit row to an "Active" lead', () => {
    const lead = mapTexasFiling(baseRow);
    expect(lead.business_name).toBe('Jo N Go LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('TX');
    expect(lead.filing_date).toBe('2026-06-06');
    expect(lead.filing_status).toBe('Active');
    expect(lead.industry).toBe('722515');
    expect(lead.address).toBe('1340 SUNSET VW, Fischer, TX 78623');
    expect(lead.source_ref).toBe('tx-comptroller:32087458215');
  });

  it('maps CT/CP/AP/PL organization types to Corporation, Corporation, Professional Association, and Limited Partnership', () => {
    expect(mapTexasFiling({ ...baseRow, taxpayer_organization_type: 'CT' }).entity_type).toBe('Corporation');
    expect(mapTexasFiling({ ...baseRow, taxpayer_organization_type: 'CP' }).entity_type).toBe('Corporation');
    expect(mapTexasFiling({ ...baseRow, taxpayer_organization_type: 'AP' }).entity_type).toBe('Professional Association');
    expect(mapTexasFiling({ ...baseRow, taxpayer_organization_type: 'PL' }).entity_type).toBe('Limited Partnership');
  });

  it('title-cases an ALL CAPS business name and city, preserving the LLC/INC suffix', () => {
    const lead = mapTexasFiling({
      ...baseRow,
      taxpayer_name: 'ASTROGA MACHINE WORKS INCORPORATED',
      taxpayer_city: 'HOUSTON',
    });
    expect(lead.business_name).toBe('Astroga Machine Works Incorporated');
    expect(lead.address).toBe('1340 SUNSET VW, Houston, TX 78623');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapTexasFiling({ taxpayer_name: 'BARE LLC', taxpayer_organization_type: 'CL' });
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('mapSanFranciscoFiling', () => {
  const baseRow: SfFilingRow = {
    ttxid: '1425013-06-261',
    ownership_name: '185 Cb, LLC',
    dba_name: 'Waters Edge',
    full_business_address: '185 Berry St Ste 1500',
    city: 'San Francisco',
    state: 'CA',
    business_zip: '94107',
    dba_start_date: '2026-06-11T00:00:00.000',
    naic_code_description: 'Food Services',
  };

  it('maps an LLC-owned DBA to a CA lead using the trade name as business_name', () => {
    const lead = mapSanFranciscoFiling(baseRow);
    expect(lead.business_name).toBe('Waters Edge');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('CA');
    expect(lead.filing_date).toBe('2026-06-11');
    expect(lead.filing_status).toBe('Active');
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBe('185 Berry St Ste 1500, San Francisco, CA 94107');
    expect(lead.industry).toBe('Food Services');
    expect(lead.source_ref).toBe('sf-business:1425013-06-261');
  });

  it('captures a sole proprietor\'s first and last name as owner_name when there is no entity suffix', () => {
    const lead = mapSanFranciscoFiling({
      ...baseRow,
      ownership_name: 'Jesse Woodward',
      dba_name: 'Collingwood Rental',
    });
    expect(lead.business_name).toBe('Collingwood Rental');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBe('Jesse Woodward');
  });

  it('falls back to ownership_name when dba_name is absent, and detects Inc/LP/LLP suffixes', () => {
    expect(mapSanFranciscoFiling({ ...baseRow, ownership_name: 'Belkorp Ag LLC', dba_name: undefined }).business_name).toBe('Belkorp Ag LLC');
    expect(mapSanFranciscoFiling({ ...baseRow, ownership_name: 'Acme Widgets Incorporated', dba_name: undefined }).entity_type).toBe('Corporation');
    expect(mapSanFranciscoFiling({ ...baseRow, ownership_name: 'Acme Properties, L.P.', dba_name: undefined }).entity_type).toBe('Limited Partnership');
    expect(mapSanFranciscoFiling({ ...baseRow, ownership_name: 'Acme Holdings LLP', dba_name: undefined }).entity_type).toBe('LLP');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapSanFranciscoFiling({ ownership_name: 'Reyna Rosa Perez Gomez', dba_name: 'Reyna Rosa Perez Gomez' });
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.source_ref).toBeUndefined();
    expect(lead.owner_name).toBe('Reyna Rosa Perez Gomez');
  });
});

describe('mapChicagoFiling', () => {
  const baseRow: ChicagoFilingRow = {
    license_id: '3087012',
    legal_name: 'MY PERFUME HOUSE LLC',
    doing_business_as_name: 'MY PERFUME HOUSE',
    address: '1150 W BELMONT AVE  4',
    city: 'CHICAGO',
    state: 'IL',
    zip_code: '60657',
    business_activity: 'Retail Sales of General Merchandise',
    date_issued: '2026-06-12T00:00:00.000',
  };

  it('maps a newly-issued Limited Business License for an LLC to an "Active" IL lead', () => {
    const lead = mapChicagoFiling(baseRow);
    expect(lead.business_name).toBe('My Perfume House');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('IL');
    expect(lead.filing_date).toBe('2026-06-12');
    expect(lead.filing_status).toBe('Active');
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBe('1150 W BELMONT AVE  4, Chicago, IL 60657');
    expect(lead.industry).toBe('Retail Sales of General Merchandise');
    expect(lead.source_ref).toBe('chicago-bl:3087012');
  });

  it('captures a sole proprietor\'s first and last name as owner_name when there is no entity suffix', () => {
    const lead = mapChicagoFiling({
      ...baseRow,
      legal_name: 'VIKTORIA BROWN',
      doing_business_as_name: 'ECLECTICA BY VIKA',
    });
    expect(lead.business_name).toBe('Eclectica By Vika');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBe('Viktoria Brown');
  });

  it('falls back to legal_name when doing_business_as_name is absent, detects Inc suffixes, and uses the first listed business activity', () => {
    const lead = mapChicagoFiling({
      ...baseRow,
      legal_name: 'Insurance Guys411 Inc',
      doing_business_as_name: undefined,
      business_activity: 'Operation of an Administrative Commercial Office | Provide Consulting Services',
    });
    expect(lead.business_name).toBe('Insurance Guys411 Inc');
    expect(lead.entity_type).toBe('Corporation');
    expect(lead.industry).toBe('Operation of an Administrative Commercial Office');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapChicagoFiling({ legal_name: 'BARE LLC' });
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('mapNorfolkFiling', () => {
  const baseRow: NorfolkFilingRow = {
    trading_as_name: 'HAIR GALLERIA 2',
    primary_owner: 'HAIR GALLERIA 2 LLC',
    naics: 'All Other Miscellaneous Retailers',
    mailing_address: '1101 E LITTLE CREEK RD NORFOLK VA, 23518',
    business_opened_date: '2026-07-03T00:00:00.000',
  };

  it('maps a newly-opened LLC business to an "Active" VA lead and reformats the mailing address', () => {
    const lead = mapNorfolkFiling(baseRow);
    expect(lead.business_name).toBe('Hair Galleria 2');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('VA');
    expect(lead.filing_date).toBe('2026-07-03');
    expect(lead.filing_status).toBe('Active');
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBe('1101 E LITTLE CREEK RD NORFOLK, VA 23518');
    expect(lead.industry).toBe('All Other Miscellaneous Retailers');
  });

  it('normalizes a "LAST, FIRST" sole-proprietor owner to "First Last"', () => {
    const lead = mapNorfolkFiling({
      ...baseRow,
      trading_as_name: 'JGB CONSTRUCTION',
      primary_owner: 'BRANT, JESSIE',
    });
    expect(lead.business_name).toBe('Jgb Construction');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBe('Jessie Brant');
  });

  it('handles a "FIRST LAST" sole-proprietor owner with no comma and no trading name', () => {
    const lead = mapNorfolkFiling({
      ...baseRow,
      trading_as_name: 'JULANNE STROBBE',
      primary_owner: 'JULANNE STROBBE',
    });
    expect(lead.business_name).toBe('Julanne Strobbe');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBe('Julanne Strobbe');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapNorfolkFiling({ primary_owner: 'BARE LLC' });
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.filing_date).toBeNull();
  });
});

describe('mapWashingtonFiling', () => {
  const baseRow: WaFilingRow = {
    contractorlicensenumber: 'DJCONCL744LE',
    businessname: 'D&J CONCRETE LLC',
    businesstypecodedesc: 'Limited Liability Company',
    primaryprincipalname: 'ROJAS RAMIREZ, DAVID',
    address1: '1035 S 5TH AVE',
    city: 'PASCO',
    state: 'WA',
    zip: '99301',
    phonenumber: '5097922741',
    licenseeffectivedate: '2026-06-15T00:00:00.000',
    specialtycode1desc: 'CONCRETE',
    contractorlicensestatus: 'ACTIVE',
  };

  it('maps a newly-effective LLC contractor license to an "ACTIVE" WA lead with phone and owner name', () => {
    const lead = mapWashingtonFiling(baseRow);
    expect(lead.business_name).toBe('D&j Concrete LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('WA');
    expect(lead.filing_date).toBe('2026-06-15');
    expect(lead.filing_status).toBe('ACTIVE');
    expect(lead.owner_name).toBe('David Rojas Ramirez');
    expect(lead.address).toBe('1035 S 5TH AVE, Pasco, WA 99301');
    expect(lead.industry).toBe('CONCRETE');
    expect(lead.phone).toBe('5097922741');
    expect(lead.source_ref).toBe('wa-li:DJCONCL744LE');
  });

  it('maps an "Individual" contractor to a lead with no entity_type and the principal as owner_name', () => {
    const lead = mapWashingtonFiling({
      ...baseRow,
      contractorlicensenumber: 'RIDGEWW742LK',
      businessname: 'RIDGEFIELD WINDOW WASHING',
      businesstypecodedesc: 'Individual',
      primaryprincipalname: 'MARSHALL, JACOB MACKENZIE',
    });
    expect(lead.business_name).toBe('Ridgefield Window Washing');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBe('Jacob Mackenzie Marshall');
  });

  it('maps a Limited Liability Partnership to "LLP" without misclassifying it as "LLC"', () => {
    const lead = mapWashingtonFiling({ ...baseRow, businesstypecodedesc: 'Limited Liability Partnership' });
    expect(lead.entity_type).toBe('LLP');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapWashingtonFiling({ businessname: 'BARE CONTRACTOR' });
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('mapDelawareFiling', () => {
  const baseRow: DeFilingRow = {
    business_name: 'BB WASH OPS 2 LLC',
    trade_name: 'BUBBLE BOSS CAR WASH',
    category: 'GENERAL SERVICES',
    current_license_valid_from: '2026-06-01T00:00:00.000',
    address_1: '111 GREENHILL AVE',
    city: 'WILMINGTON',
    state: 'DE',
    zip: '198051842',
    license_number: '2026706274',
  };

  it('maps a newly-licensed LLC with a DBA to an "Active" DE lead, using the DBA as business_name', () => {
    const lead = mapDelawareFiling(baseRow);
    expect(lead.business_name).toBe('Bubble Boss Car Wash');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('DE');
    expect(lead.filing_date).toBe('2026-06-01');
    expect(lead.filing_status).toBe('Active');
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBe('111 GREENHILL AVE, Wilmington, DE 198051842');
    expect(lead.industry).toBe('General Services');
    expect(lead.source_ref).toBe('de-license:2026706274');
  });

  it('strips the "&QUOT;,&QUOT;0" export artifact from a sole-proprietor business_name and captures the owner', () => {
    const lead = mapDelawareFiling({
      ...baseRow,
      business_name: 'SHON GEORGE&QUOT;,&QUOT;0',
      trade_name: 'THE RIGHT PATH',
    });
    expect(lead.business_name).toBe('The Right Path');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBe('Shon George');
  });

  it('falls back to the cleaned business_name when no DBA is present', () => {
    const lead = mapDelawareFiling({ ...baseRow, business_name: 'DEREK GRUENHAGEN', trade_name: 'CREEDABLE' });
    expect(lead.business_name).toBe('Creedable');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBe('Derek Gruenhagen');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapDelawareFiling({ business_name: 'BARE LLC' });
    expect(lead.business_name).toBe('Bare LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('mapNewOrleansFiling', () => {
  const baseRow: NolaFilingRow = {
    businessname: 'MENDED PATH, LLC',
    ownername: 'MENDED PATH, LLC',
    businesstype: 'Offices of Health Practitioners, All Other Miscellaneous',
    businesslicensenumber: '123456',
    businessstartdate: '2026-10-01T00:00:00.000',
    streetnumber: '4706',
    streetname: 'SAINT PETER',
    streetsuffix: 'ST',
    city: 'NEW ORLEANS',
    state: 'LA',
    zip: '70119-4435',
    phonenumber: '(504) 338-1123',
  };

  it('maps a newly-licensed LLC to an "Active" LA lead, omitting owner_name when it duplicates business_name', () => {
    const lead = mapNewOrleansFiling(baseRow);
    expect(lead.business_name).toBe('Mended Path, LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('LA');
    expect(lead.filing_date).toBe('2026-10-01');
    expect(lead.filing_status).toBe('Active');
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBe('4706 Saint Peter St, New Orleans, LA 70119-4435');
    expect(lead.industry).toBe('Offices of Health Practitioners, All Other Miscellaneous');
    expect(lead.phone).toBe('(504) 338-1123');
    expect(lead.source_ref).toBe('nola-license:123456');
  });

  it('captures a distinct individual owner alongside the LLC business name', () => {
    const lead = mapNewOrleansFiling({ ...baseRow, businessname: 'IT FITSS LLC', ownername: 'STEVEN L. CODY JR.' });
    expect(lead.business_name).toBe('It Fitss LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.owner_name).toBe('Steven L. Cody Jr.');
  });

  it('treats a truncated "DBA" owner-name artifact as not a person, leaving entity_type and owner_name null', () => {
    const lead = mapNewOrleansFiling({
      ...baseRow,
      businessname: 'HELLO SUNSHINE',
      ownername: 'HELLO SUNSHINE, LLC DBA HELLO',
      businesstype: "Women's Clothing Stores",
      businessstartdate: '2026-07-01T00:00:00.000',
      city: 'NEW ORLEANS',
      state: 'LA',
      zip: '70130-0000',
      phonenumber: '(269) 252-8095',
    });
    expect(lead.business_name).toBe('Hello Sunshine');
    expect(lead.entity_type).toBeNull();
    expect(lead.owner_name).toBeNull();
    expect(lead.phone).toBe('(269) 252-8095');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapNewOrleansFiling({ businessname: 'BARE LLC' });
    expect(lead.business_name).toBe('Bare LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.owner_name).toBeNull();
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('mapMesaFiling', () => {
  const baseRow: MesaFilingRow = {
    record_id: 'LIC26-18728',
    business_dba_name: 'On Services LLC',
    naicscodesanddescriptions__2022_naics_title: 'Plumbing, Heating, and Air-Conditioning Contractors',
    new_business_address: '633 W 2ND AVE MESA, AZ 85210',
    business_mailing_address: '633 W 2ND AVE MESA, AZ 85210',
    business_phone_number: '4805863004',
    openeddate: '2026-06-11T00:00:00.000',
    type_of_ownership: 'LLC',
  };

  it('maps a newly-opened LLC license to an "Active" AZ lead with a title-cased street address', () => {
    const lead = mapMesaFiling(baseRow);
    expect(lead.business_name).toBe('On Services LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('AZ');
    expect(lead.filing_date).toBe('2026-06-11');
    expect(lead.filing_status).toBe('Active');
    expect(lead.address).toBe('633 W 2nd Ave Mesa, AZ 85210');
    expect(lead.industry).toBe('Plumbing, Heating, and Air-Conditioning Contractors');
    expect(lead.phone).toBe('4805863004');
    expect(lead.source_ref).toBe('mesa-license:LIC26-18728');
  });

  it('maps "Corporation" ownership to entity_type Corporation and preserves an out-of-state address suffix', () => {
    const lead = mapMesaFiling({
      ...baseRow,
      business_dba_name: 'Wadman Corporation',
      type_of_ownership: 'Corporation',
      new_business_address: '2920 S 925 W  , UT 84401',
      business_mailing_address: '2920 S 925 W  , UT 84401',
    });
    expect(lead.entity_type).toBe('Corporation');
    expect(lead.address).toBe('2920 S 925 W, UT 84401');
  });

  it('maps "Individual/Sole Proprietor" ownership to a null entity_type with no address when none is provided', () => {
    const lead = mapMesaFiling({
      record_id: 'LIC26-18713',
      business_dba_name: 'marisol fresh clean',
      naicscodesanddescriptions__2022_naics_title: 'Janitorial Services',
      business_phone_number: '602 930 7415',
      openeddate: '2026-06-11T00:00:00.000',
      type_of_ownership: 'Individual/Sole Proprietor',
    });
    expect(lead.business_name).toBe('marisol fresh clean');
    expect(lead.entity_type).toBeNull();
    expect(lead.address).toBeNull();
    expect(lead.phone).toBe('602 930 7415');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapMesaFiling({ business_dba_name: 'QUIET DESK LLC' });
    expect(lead.business_name).toBe('Quiet Desk LLC');
    expect(lead.entity_type).toBeNull();
    expect(lead.state).toBe('AZ');
    expect(lead.address).toBeNull();
    expect(lead.industry).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('mapBentonvilleFiling', () => {
  const baseRow: BentonvilleFilingRow = {
    OBJECTID: 481,
    Business_Name: 'Ozark Natural Lawn Care LLC',
    Business_Phone: '479-348-5066',
    Email: 'info@ozarklawn.com',
    website: 'https://ozarklawn.com/',
    Physical_Address: '904 SW GREEN WORLD ST',
    ZIP: 72712,
    Type_of_Business: 'Other Services (Except Public Administration)',
    Type_of_Ownership: 'LLC',
    Date_of_Application: 1776222000000, // 2026-04-15
    New_Business: 'NEW',
    STATUS: 'ISSUED',
  };

  it('maps a newly-submitted LLC registration to an "Active" AR lead with email, website, and a title-cased address', () => {
    const lead = mapBentonvilleFiling(baseRow);
    expect(lead.business_name).toBe('Ozark Natural Lawn Care LLC');
    expect(lead.entity_type).toBe('LLC');
    expect(lead.state).toBe('AR');
    expect(lead.filing_date).toBe('2026-04-15');
    expect(lead.filing_status).toBe('Active');
    expect(lead.address).toBe('904 Sw Green World St, Bentonville, AR 72712');
    expect(lead.industry).toBe('Other Services (Except Public Administration)');
    expect(lead.website).toBe('https://ozarklawn.com/');
    expect(lead.email).toBe('info@ozarklawn.com');
    expect(lead.phone).toBe('479-348-5066');
    expect(lead.source_ref).toBe('bentonville-business:481');
  });

  it('maps "SOLE PROPRIETORSHIP" ownership to entity_type "Sole Proprietorship" and a "RECEIVED" status to "Pending"', () => {
    const lead = mapBentonvilleFiling({
      ...baseRow,
      Business_Name: 'Dharini Jayaraman',
      Type_of_Ownership: 'SOLE PROPRIETORSHIP',
      STATUS: 'RECEIVED',
      ZIP: undefined,
    });
    expect(lead.entity_type).toBe('Sole Proprietorship');
    expect(lead.filing_status).toBe('Pending');
    expect(lead.address).toBe('904 Sw Green World St, Bentonville, AR');
  });

  it('handles missing fields gracefully', () => {
    const lead = mapBentonvilleFiling({ Business_Name: 'QUIET DESK LLC', New_Business: 'NEW' });
    expect(lead.business_name).toBe('Quiet Desk LLC');
    expect(lead.entity_type).toBeNull();
    expect(lead.state).toBe('AR');
    expect(lead.address).toBe('Bentonville, AR');
    expect(lead.industry).toBeNull();
    expect(lead.website).toBeNull();
    expect(lead.email).toBeNull();
    expect(lead.phone).toBeNull();
    expect(lead.filing_date).toBeNull();
    expect(lead.filing_status).toBeNull();
    expect(lead.source_ref).toBeUndefined();
  });
});

describe('STATE_FEED_SOURCES / NY_NEW_ENTITY_DOC_TYPES / CO_NEW_ENTITY_TYPES / FL_NEW_ENTITY_FILING_TYPES / OR_NEW_ENTITY_TYPES / PA_NEW_ENTITY_TYPES / CT_NEW_ENTITY_TYPES / TX_NEW_ENTITY_TYPES', () => {
  it('registers the New York, Colorado, Florida, Oregon, Pennsylvania, Connecticut, Texas, California, Illinois, Virginia, Washington, Delaware, Louisiana, Arizona, and Arkansas feeds with labels', () => {
    expect(STATE_FEED_SOURCES.NY.label).toMatch(/New York/);
    expect(STATE_FEED_SOURCES.CO.label).toMatch(/Colorado/);
    expect(STATE_FEED_SOURCES.FL.label).toMatch(/Florida/);
    expect(STATE_FEED_SOURCES.OR.label).toMatch(/Oregon/);
    expect(STATE_FEED_SOURCES.PA.label).toMatch(/Pennsylvania/);
    expect(STATE_FEED_SOURCES.CT.label).toMatch(/Connecticut/);
    expect(STATE_FEED_SOURCES.TX.label).toMatch(/Texas/);
    expect(STATE_FEED_SOURCES.CA.label).toMatch(/California/);
    expect(STATE_FEED_SOURCES.IL.label).toMatch(/Illinois/);
    expect(STATE_FEED_SOURCES.VA.label).toMatch(/Virginia/);
    expect(STATE_FEED_SOURCES.WA.label).toMatch(/Washington/);
    expect(STATE_FEED_SOURCES.DE.label).toMatch(/Delaware/);
    expect(STATE_FEED_SOURCES.LA.label).toMatch(/Louisiana/);
    expect(STATE_FEED_SOURCES.AZ.label).toMatch(/Arizona/);
    expect(STATE_FEED_SOURCES.AR.label).toMatch(/Arkansas/);
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
    expect(TX_NEW_ENTITY_TYPES).toEqual(['CL', 'CT', 'CP', 'AP', 'PL']);
    expect(TX_NEW_ENTITY_TYPES).not.toContain('IS');
    expect(TX_NEW_ENTITY_TYPES).not.toContain('CI');
  });
});
