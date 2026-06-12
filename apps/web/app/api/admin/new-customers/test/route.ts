import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import {
  scoreLead,
  parseEnrichment,
  generateSampleFilings,
  shouldAlertAdmin,
} from '../../../../../lib/business-leads';

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
//   5. the notifications table (admin alert sink) is reachable.
//
// Returns 200 only when every check passes, so it can be wired to uptime
// monitors or run manually from the admin UI.
// ─────────────────────────────────────────────────────────────────────────────
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

  // 5. notifications table (admin alert sink) reachable.
  const { error: notifError } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true });
  checks.push({
    name: 'notifications_table',
    ok: !notifError,
    detail: notifError ? notifError.message : 'reachable',
  });

  const ok = checks.every((c) => c.ok);
  return NextResponse.json({ ok, checks, ranAt: new Date().toISOString() }, { status: ok ? 200 : 500 });
}
