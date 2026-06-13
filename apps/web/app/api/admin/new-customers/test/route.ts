import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import {
  scoreLead,
  parseEnrichment,
  generateSampleFilings,
  shouldAlertAdmin,
  buildIncorporationDateFilter,
} from '../../../../../lib/business-leads';
import { mapNyFiling, mapCoFiling, mapFlFiling, parseFlCorLine, mapOregonFilings, mapPaFiling, mapConnecticutFiling, mapTexasFiling, mapSanFranciscoFiling, mapChicagoFiling, mapNorfolkFiling, mapWashingtonFiling, mapDelawareFiling, mapNewOrleansFiling, mapMesaFiling } from '../../../../../lib/state-filings';

export const dynamic = 'force-dynamic';

type Check = { name: string; ok: boolean; detail: string };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/new-customers/test
//
// Live self-test for the New Customers pipeline. Verifies, end to end, that:
//   1. the scoring logic runs and is deterministic,
//   2. the AI-enrichment JSON parser sanitizes untrusted input,
//   3. the sample free data source produces valid filings,
//   4. the business_leads table is reachable in Supabase,
//   5. the "New Business Leads" marketing segment exists (lead→Marketing tie-in),
//   6. the notifications table (admin alert sink) is reachable,
//   7. the OpenCorporates date-range filter builds correctly (defaults to "today"),
//   8. whether OPENCORPORATES_API_TOKEN is configured for live pulls (informational),
//   9. the free NY state-registry connector maps a filing row correctly,
//  10. the free CO state-registry connector maps a filing row correctly,
//  11. the free FL state-registry connector parses a fixed-width record and
//      maps it correctly,
//  12. the free OR state-registry connector groups multi-row registry data
//      (incl. the filer's first/last name) into one lead correctly,
//  13. the free PA state-registry connector maps a filing row (incl. the
//      Organizer's first/last name) correctly.
//  14. the free CT state-registry connector maps a filing row (incl. the
//      registrant's email address, published directly by CT) correctly.
//  15. the free TX state-registry connector maps a new sales-tax-permit row
//      for an in-state LLC correctly.
//  16. the free CA (San Francisco) state-registry connector maps a new
//      business-registration row to a CA lead, including sole-proprietor
//      owner first/last name capture, correctly.
//  17. the free IL (Chicago) state-registry connector maps a new Limited
//      Business License row to an IL lead, including LLC/Inc entity-type
//      detection and DBA name capture, correctly.
//  18. the free VA (Norfolk) state-registry connector maps a newly-opened
//      business row to a VA lead, including "LAST, FIRST" sole-proprietor
//      owner-name normalization, correctly.
//  19. the free WA (L&I Contractor Licenses) state-registry connector maps a
//      newly-effective license row to a WA lead, including the direct phone
//      number and "LAST, FIRST" principal-name normalization, correctly.
//  20. the free DE (Business License Open Data) state-registry connector maps
//      a newly-licensed row to a DE lead, including DBA capture and stripping
//      the "&QUOT;,&QUOT;0" sole-proprietor export artifact, correctly.
//
// Returns 200 only when every check passes, so it can be wired to uptime
// monitors or run manually from the admin UI.
// ─────────────────────────────────────────────────────────────────────────────

// Builds a fixed-width Sunbiz cor.txt record by placing fields at the
// documented 0-indexed byte ranges (see lib/state-filings.ts), padding the
// rest with spaces — used to self-test parseFlCorLine/mapFlFiling without a
// live SFTP connection.
function buildFlCorLine(fields: Record<string, string>, length = 1440): string {
  const chars = new Array(length).fill(' ');
  const ranges: Record<string, [number, number]> = {
    corporationNumber: [0, 12],
    corporationName: [12, 192],
    status: [204, 1],
    filingType: [205, 15],
    addressLine1: [220, 42],
    city: [304, 28],
    state: [332, 2],
    zip: [334, 10],
    fileDate: [472, 8],
    registeredAgentName: [544, 42],
  };
  for (const [key, value] of Object.entries(fields)) {
    const [start, len] = ranges[key];
    for (let i = 0; i < Math.min(value.length, len); i++) chars[start + i] = value[i];
  }
  return chars.join('');
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const checks: Check[] = [];

  // 1. Scoring logic — a fully-contactable, fresh, on-target lead should score high.
  const strong = scoreLead({
    business_name: 'Riverside Community Foundation LLC',
    entity_type: 'LLC',
    state: 'DE',
    filing_date: new Date().toISOString().slice(0, 10),
    website: 'https://riversidecf.org',
    email: 'info@riversidecf.org',
    phone: '(302) 555-0148',
    owner_name: 'Jane Doe',
    address: 'Wilmington, DE',
  });
  checks.push({
    name: 'scoring',
    ok: strong.score >= 80 && strong.grade === 'A' && shouldAlertAdmin(strong.score),
    detail: `strong lead scored ${strong.score} (grade ${strong.grade})`,
  });

  // 2. Enrichment parser — must drop a malformed email and bad phone, keep website.
  const cleaned = parseEnrichment({ website: 'acme.com', email: 'not-an-email', phone: '123' });
  checks.push({
    name: 'enrichment_parser',
    ok: cleaned.website === 'https://acme.com' && cleaned.email === null && cleaned.phone === null,
    detail: `parsed website=${cleaned.website}, email=${cleaned.email}, phone=${cleaned.phone}`,
  });

  // 3. Sample source — deterministic, valid, de-duplicated filings.
  const samples = generateSampleFilings(5, 12345);
  const allNamed = samples.length === 5 && samples.every((s) => s.business_name && s.state);
  checks.push({
    name: 'sample_source',
    ok: allNamed,
    detail: `generated ${samples.length} sample filings`,
  });

  // 4. business_leads table reachable.
  const { error: leadsError } = await supabaseAdmin
    .from('business_leads')
    .select('id', { count: 'exact', head: true });
  checks.push({
    name: 'business_leads_table',
    ok: !leadsError,
    detail: leadsError ? leadsError.message : 'reachable',
  });

  // 5. "New Business Leads" marketing segment exists — confirms the
  // business_leads ↔ marketing_contacts tie-in migration has run, so
  // enriched leads with an email can be targeted by a Marketing campaign.
  const { data: leadSegment, error: segmentError } = await supabaseAdmin
    .from('marketing_segments')
    .select('id')
    .eq('name', 'New Business Leads')
    .eq('is_system', true)
    .maybeSingle();
  checks.push({
    name: 'marketing_leads_segment',
    ok: !segmentError && !!leadSegment,
    detail: segmentError ? segmentError.message : (leadSegment ? `segment ${leadSegment.id}` : 'segment not found — run the latest Supabase migrations'),
  });

  // 6. notifications table (admin alert sink) reachable.
  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true });
  checks.push({
    name: 'notifications_table',
    ok: !notifError,
    detail: notifError ? notifError.message : 'reachable',
  });

  // 7. Date-range filter — "today" should resolve to an exact-date filter,
  // matching the admin UI's default (pull new filings from today).
  const today = new Date().toISOString().slice(0, 10);
  const exactToday = buildIncorporationDateFilter(today, today);
  const openAfter = buildIncorporationDateFilter(today, null);
  const noFilter = buildIncorporationDateFilter(null, null);
  checks.push({
    name: 'date_range_filter',
    ok: exactToday === today && openAfter === `${today}:` && noFilter === null,
    detail: `today→${exactToday}, openAfter→${openAfter}, none→${noFilter}`,
  });

  // 8. OpenCorporates token — informational only. The pipeline degrades to "no
  // results" without one, so this never fails the overall self-test.
  const hasOcToken = !!process.env.OPENCORPORATES_API_TOKEN;
  checks.push({
    name: 'opencorporates_token',
    ok: true,
    detail: hasOcToken
      ? 'OPENCORPORATES_API_TOKEN is configured — live OpenCorporates pulls are enabled.'
      : 'OPENCORPORATES_API_TOKEN not set — OpenCorporates pulls will return no results until configured (use sample filings meanwhile).',
  });

  // 9. NY state-registry connector — a sample "Articles of Organization" row
  // should map to a properly-typed, named, NY-located LLC lead.
  const nyLead = mapNyFiling({
    corpid_num: '7938482',
    corp_name: 'CHIAPPERINO LLC',
    entitytype: 'DOMESTIC LIMITED LIABILITY COMPANY',
    documenttype: 'ARTICLES OF ORGANIZATION',
    date_filed: '2026-06-09T00:00:00.000',
    cnty_prin_ofc: 'Kings',
  });
  checks.push({
    name: 'ny_state_feed',
    ok: nyLead.business_name === 'Chiapperino LLC' && nyLead.entity_type === 'LLC' && nyLead.state === 'NY' && nyLead.filing_date === '2026-06-09',
    detail: `mapped "${nyLead.business_name}" (${nyLead.entity_type}, ${nyLead.state}, filed ${nyLead.filing_date})`,
  });

  // 10. CO state-registry connector — a sample domestic LLC formation row
  // should map to a properly-typed, named, CO-located LLC lead.
  const coLead = mapCoFiling({
    entityid: '20261714629',
    entityname: 'SETTLE QUANTUMEX LLC',
    entitytype: 'DLLC',
    entitystatus: 'Good Standing',
    entityformdate: '2026-06-11T00:00:00.000',
    principalcity: 'Denver',
    principalstate: 'CO',
  });
  checks.push({
    name: 'co_state_feed',
    ok: coLead.business_name === 'Settle Quantumex LLC' && coLead.entity_type === 'LLC' && coLead.state === 'CO' && coLead.filing_date === '2026-06-11',
    detail: `mapped "${coLead.business_name}" (${coLead.entity_type}, ${coLead.state}, filed ${coLead.filing_date})`,
  });

  // 11. FL state-registry connector — a sample fixed-width Sunbiz cor.txt
  // record for a new domestic LLC should parse and map correctly.
  const flLine = buildFlCorLine({
    corporationNumber: 'L26000123456',
    corporationName: 'GULF COAST VENTURES LLC',
    status: 'A',
    filingType: 'FLAL',
    addressLine1: '100 BISCAYNE BLVD',
    city: 'MIAMI',
    state: 'FL',
    zip: '33131',
    fileDate: '20260612',
    registeredAgentName: 'CT CORPORATION SYSTEM',
  });
  const flRow = parseFlCorLine(flLine);
  const flLead = flRow ? mapFlFiling(flRow) : null;
  checks.push({
    name: 'fl_state_feed',
    ok: !!flLead && flLead.business_name === 'Gulf Coast Ventures LLC' && flLead.entity_type === 'LLC' && flLead.state === 'FL' && flLead.filing_date === '2026-06-12',
    detail: flLead
      ? `mapped "${flLead.business_name}" (${flLead.entity_type}, ${flLead.state}, filed ${flLead.filing_date})`
      : 'parseFlCorLine returned null',
  });

  // 12. OR state-registry connector — a sample multi-row registry group
  // (one row per associated_name_type) should group into a single lead,
  // surfacing the filer's first/last name as owner_name.
  const orGroup = [
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
      associated_name_type: 'PRINCIPAL PLACE OF BUSINESS',
      address_: '1300 SW PARK AVE',
      city: 'PORTLAND',
      state: 'OR',
      zip_code: '97201',
    },
  ];
  const [orLead] = mapOregonFilings(orGroup);
  checks.push({
    name: 'or_state_feed',
    ok: !!orLead && orLead.business_name === 'Financegoalz LLC' && orLead.entity_type === 'LLC' && orLead.state === 'OR' && orLead.filing_date === '2026-05-29' && orLead.owner_name === 'Danielle Duncan',
    detail: orLead
      ? `mapped "${orLead.business_name}" (${orLead.entity_type}, ${orLead.state}, filed ${orLead.filing_date}, owner ${orLead.owner_name})`
      : 'mapOregonFilings returned no leads',
  });

  // 13. PA state-registry connector — a sample domestic LLC filing row,
  // including the Organizer's first/last name, should map correctly.
  const paLead = mapPaFiling({
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
  });
  checks.push({
    name: 'pa_state_feed',
    ok: paLead.business_name === "Marberger's Contractors Llc" && paLead.entity_type === 'LLC' && paLead.state === 'PA' && paLead.filing_date === '2025-07-30' && paLead.owner_name === 'Curtis Marberger',
    detail: `mapped "${paLead.business_name}" (${paLead.entity_type}, ${paLead.state}, filed ${paLead.filing_date}, owner ${paLead.owner_name})`,
  });

  // 14. CT state-registry connector — a sample domestic LLC filing row should
  // map correctly, including the registrant email published directly by CT.
  const ctLead = mapConnecticutFiling({
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
  });
  checks.push({
    name: 'ct_state_feed',
    ok: ctLead.business_name === 'Nutmeg Accounting LLC' && ctLead.entity_type === 'LLC' && ctLead.state === 'CT' && ctLead.filing_date === '2026-06-11' && ctLead.email === 'sahmed@nutmegaccountingllc.com',
    detail: `mapped "${ctLead.business_name}" (${ctLead.entity_type}, ${ctLead.state}, filed ${ctLead.filing_date}, email ${ctLead.email})`,
  });

  // 15. TX state-registry connector — a sample new sales-tax-permit row for
  // an in-state LLC should map to a properly-typed, named, TX-located lead.
  const txLead = mapTexasFiling({
    taxpayer_number: '32087458215',
    taxpayer_name: 'JO N GO LLC',
    taxpayer_address: '1340 SUNSET VW',
    taxpayer_city: 'FISCHER',
    taxpayer_state: 'TX',
    taxpayer_zip_code: '78623',
    taxpayer_organization_type: 'CL',
    outlet_naics_code: '722515',
    outlet_permit_issue_date: '2026-06-06T00:00:00.000',
  });
  checks.push({
    name: 'tx_state_feed',
    ok: txLead.business_name === 'Jo N Go LLC' && txLead.entity_type === 'LLC' && txLead.state === 'TX' && txLead.filing_date === '2026-06-06' && txLead.filing_status === 'Active',
    detail: `mapped "${txLead.business_name}" (${txLead.entity_type}, ${txLead.state}, filed ${txLead.filing_date}, status ${txLead.filing_status})`,
  });

  // 16. CA (San Francisco) state-registry connector — a sole-proprietor row
  // with no entity suffix should map to a CA lead with the owner's first and
  // last name captured directly.
  const caLead = mapSanFranciscoFiling({
    ttxid: '1425027-06-261-1185371',
    ownership_name: 'Jesse Woodward',
    dba_name: 'Collingwood Rental',
    full_business_address: '245 Collingwood St',
    city: 'San Francisco',
    state: 'CA',
    business_zip: '94114',
    dba_start_date: '2026-06-11T00:00:00.000',
    naic_code_description: 'Accommodations',
  });
  checks.push({
    name: 'ca_state_feed',
    ok: caLead.business_name === 'Collingwood Rental' && caLead.entity_type === null && caLead.state === 'CA' && caLead.filing_date === '2026-06-11' && caLead.owner_name === 'Jesse Woodward',
    detail: `mapped "${caLead.business_name}" (${caLead.entity_type}, ${caLead.state}, filed ${caLead.filing_date}, owner ${caLead.owner_name})`,
  });

  // 17. IL (Chicago) state-registry connector — a newly-issued Limited
  // Business License for an LLC should map to a properly-typed, named,
  // IL-located lead using the DBA name as business_name.
  const ilLead = mapChicagoFiling({
    license_id: '3087012',
    legal_name: 'MY PERFUME HOUSE LLC',
    doing_business_as_name: 'MY PERFUME HOUSE',
    address: '1150 W BELMONT AVE  4',
    city: 'CHICAGO',
    state: 'IL',
    zip_code: '60657',
    business_activity: 'Retail Sales of General Merchandise',
    date_issued: '2026-06-12T00:00:00.000',
  });
  checks.push({
    name: 'il_state_feed',
    ok: ilLead.business_name === 'My Perfume House' && ilLead.entity_type === 'LLC' && ilLead.state === 'IL' && ilLead.filing_date === '2026-06-12' && ilLead.filing_status === 'Active',
    detail: `mapped "${ilLead.business_name}" (${ilLead.entity_type}, ${ilLead.state}, filed ${ilLead.filing_date}, status ${ilLead.filing_status})`,
  });

  // 18. VA (Norfolk) state-registry connector — a sole-proprietor row with a
  // "LAST, FIRST" primary_owner should map to a VA lead with the owner's
  // first and last name normalized to "First Last".
  const vaLead = mapNorfolkFiling({
    trading_as_name: 'JGB CONSTRUCTION',
    primary_owner: 'BRANT, JESSIE',
    naics: 'Contractor, Handyman',
    mailing_address: '1364 CHANELKA RD NORFOLK VA, 23503',
    business_opened_date: '2026-06-06T00:00:00.000',
  });
  checks.push({
    name: 'va_state_feed',
    ok: vaLead.business_name === 'Jgb Construction' && vaLead.entity_type === null && vaLead.state === 'VA' && vaLead.filing_date === '2026-06-06' && vaLead.owner_name === 'Jessie Brant',
    detail: `mapped "${vaLead.business_name}" (${vaLead.entity_type}, ${vaLead.state}, filed ${vaLead.filing_date}, owner ${vaLead.owner_name})`,
  });

  // 19. WA (L&I Contractor Licenses) state-registry connector — a
  // newly-effective LLC contractor-license row should map to a WA lead with
  // the direct phone number and "LAST, FIRST" principal name normalized.
  const waLead = mapWashingtonFiling({
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
  });
  checks.push({
    name: 'wa_state_feed',
    ok: waLead.business_name === 'D&j Concrete LLC' && waLead.entity_type === 'LLC' && waLead.state === 'WA' && waLead.filing_date === '2026-06-15' && waLead.owner_name === 'David Rojas Ramirez' && waLead.phone === '5097922741',
    detail: `mapped "${waLead.business_name}" (${waLead.entity_type}, ${waLead.state}, filed ${waLead.filing_date}, owner ${waLead.owner_name}, phone ${waLead.phone})`,
  });

  // 20. DE (Business License Open Data) state-registry connector — a
  // sole-proprietor row with the "&QUOT;,&QUOT;0" export artifact should map
  // to a DE lead with the artifact stripped and the DBA captured as
  // business_name.
  const deLead = mapDelawareFiling({
    business_name: 'SHON GEORGE&QUOT;,&QUOT;0',
    trade_name: 'THE RIGHT PATH',
    category: 'GENERAL SERVICES',
    current_license_valid_from: '2026-03-01T00:00:00.000',
    address_1: '123 MAIN ST',
    city: 'DOVER',
    state: 'DE',
    zip: '19901',
    license_number: '2026900001',
  });
  checks.push({
    name: 'de_state_feed',
    ok: deLead.business_name === 'The Right Path' && deLead.entity_type === null && deLead.state === 'DE' && deLead.filing_date === '2026-03-01' && deLead.owner_name === 'Shon George',
    detail: `mapped "${deLead.business_name}" (${deLead.entity_type}, ${deLead.state}, filed ${deLead.filing_date}, owner ${deLead.owner_name})`,
  });

  // 21. LA (New Orleans Occupational Licenses) state-registry connector — a
  // newly-issued LLC license row with a distinct individual owner should map
  // to an LA lead with the direct phone number and owner's first/last name
  // captured alongside the LLC entity_type.
  const laLead = mapNewOrleansFiling({
    businessname: 'IT FITSS LLC',
    ownername: 'STEVEN L. CODY JR.',
    businesstype: 'Miscellaneous Store Retailers(except Tobacco), All Other',
    businesslicensenumber: '789012',
    businessstartdate: '2026-07-01T00:00:00.000',
    streetnumber: '406',
    streetname: 'BON TEMPS ROULE',
    city: 'MANDEVILLE',
    state: 'LA',
    zip: '70471-2560',
    phonenumber: '(850) 305-3372',
  });
  checks.push({
    name: 'la_state_feed',
    ok: laLead.business_name === 'It Fitss LLC' && laLead.entity_type === 'LLC' && laLead.state === 'LA' && laLead.filing_date === '2026-07-01' && laLead.owner_name === 'Steven L. Cody Jr.' && laLead.phone === '(850) 305-3372',
    detail: `mapped "${laLead.business_name}" (${laLead.entity_type}, ${laLead.state}, filed ${laLead.filing_date}, owner ${laLead.owner_name}, phone ${laLead.phone})`,
  });

  // 22. AZ (City of Mesa Business Licenses) state-registry connector — a
  // newly-opened LLC license row should map to an AZ lead with a title-cased
  // street address, NAICS-derived industry, and direct phone number.
  const azLead = mapMesaFiling({
    record_id: 'LIC26-18728',
    business_dba_name: 'On Services LLC',
    naicscodesanddescriptions__2022_naics_title: 'Plumbing, Heating, and Air-Conditioning Contractors',
    new_business_address: '633 W 2ND AVE MESA, AZ 85210',
    business_phone_number: '4805863004',
    openeddate: '2026-06-11T00:00:00.000',
    type_of_ownership: 'LLC',
  });
  checks.push({
    name: 'az_state_feed',
    ok: azLead.business_name === 'On Services LLC' && azLead.entity_type === 'LLC' && azLead.state === 'AZ' && azLead.filing_date === '2026-06-11' && azLead.address === '633 W 2nd Ave Mesa, AZ 85210' && azLead.phone === '4805863004',
    detail: `mapped "${azLead.business_name}" (${azLead.entity_type}, ${azLead.state}, filed ${azLead.filing_date}, address ${azLead.address}, phone ${azLead.phone})`,
  });

  const ok = checks.every((c) => c.ok);
  return NextResponse.json({ ok, checks, ranAt: new Date().toISOString() }, { status: ok ? 200 : 500 });
}
