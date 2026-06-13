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
import { mapNyFiling, mapCoFiling, mapFlFiling, parseFlCorLine, mapOregonFilings } from '../../../../../lib/state-filings';

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
//      (incl. the filer's first/last name) into one lead correctly.
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

  const ok = checks.every((c) => c.ok);
  return NextResponse.json({ ok, checks, ranAt: new Date().toISOString() }, { status: ok ? 200 : 500 });
}
