import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { totalHours, type VolunteerHoursRow } from '../../../../lib/volunteer-shifts-core';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/volunteers/hours?scope=mine|to-verify
//
// The missing half of CHAR-1102. Check-in, check-out and verify all shipped, but
// nothing could *list* hours — so a volunteer could not see what they had logged
// and an organizer had no queue to verify from, leaving the verify endpoint with
// no caller (the same shape as the volunteer-applications black hole).
//
// `scope=mine`      → the caller's own rows.
// `scope=to-verify` → rows on opportunities the caller owns. Ownership is applied
//                     to the opportunity query first, so the hours query is
//                     filtered by ids the caller demonstrably owns.
//
// Totals come from `totalHours()`, which keeps verified/pending/rejected separate
// on purpose: only verified hours may be shown to an employer, and a single
// combined figure would invite exactly the conflation this feature prevents.
// ─────────────────────────────────────────────────────────────────────────────

const HOURS_COLUMNS =
  'id, shift_id, opportunity_id, volunteer_user_id, checked_in_at, checked_out_at, hours, source, status';

type Row = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = request.nextUrl.searchParams.get('scope') === 'to-verify' ? 'to-verify' : 'mine';

  let rows: Row[] = [];
  let opportunityIds: string[] = [];

  if (scope === 'mine') {
    const { data, error } = await supabaseAdmin
      .from('volunteer_hours')
      .select(HOURS_COLUMNS)
      .eq('volunteer_user_id', user.id)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(500);
    // A failed read must not read as "you have logged no hours" — these are hours
    // someone worked, and reporting zero is a claim we cannot make.
    if (error) {
      return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
    rows = (data ?? []) as Row[];
    opportunityIds = [...new Set(rows.map((r) => r.opportunity_id as string))];
  } else {
    const { data: opps, error: oppError } = await supabaseAdmin
      .from('volunteer_opportunities')
      .select('id')
      .eq('created_by', user.id)
      .is('deleted_at', null);
    if (oppError) {
      return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
    opportunityIds = ((opps ?? []) as Row[]).map((o) => o.id as string);
    if (opportunityIds.length === 0) {
      return NextResponse.json({ scope, hours: [], totals: totalHours([]), opportunities: [] });
    }
    const { data, error } = await supabaseAdmin
      .from('volunteer_hours')
      .select(HOURS_COLUMNS)
      .in('opportunity_id', opportunityIds)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(500);
    if (error) {
      return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
    }
    rows = (data ?? []) as Row[];
  }

  // Batched name lookups — never one query per row.
  const [oppRes, profileRes] = await Promise.all([
    opportunityIds.length
      ? supabaseAdmin.from('volunteer_opportunities').select('id, title, org_name').in('id', opportunityIds)
      : Promise.resolve({ data: [] as Row[] }),
    scope === 'to-verify' && rows.length
      ? supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', [...new Set(rows.map((r) => r.volunteer_user_id as string))])
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  const oppById = new Map<string, { title: string; orgName: string | null }>();
  for (const o of (oppRes.data ?? []) as Row[]) {
    oppById.set(o.id as string, {
      title: (o.title as string) ?? 'Opportunity',
      orgName: (o.org_name as string | null) ?? null,
    });
  }
  const nameById = new Map<string, string>();
  for (const p of (profileRes.data ?? []) as Row[]) {
    nameById.set(p.id as string, (p.full_name as string | null) ?? 'Volunteer');
  }

  const hours = rows.map((r) => ({
    id: r.id as string,
    opportunityId: r.opportunity_id as string,
    opportunityTitle: oppById.get(r.opportunity_id as string)?.title ?? 'Opportunity',
    orgName: oppById.get(r.opportunity_id as string)?.orgName ?? null,
    volunteerUserId: r.volunteer_user_id as string,
    volunteerName: nameById.get(r.volunteer_user_id as string) ?? null,
    checkedInAt: (r.checked_in_at as string | null) ?? null,
    checkedOutAt: (r.checked_out_at as string | null) ?? null,
    hours: typeof r.hours === 'number' ? r.hours : 0,
    source: r.source as string,
    status: r.status as string,
    /** True while the clock is still running — check-out has not happened. */
    open: r.checked_in_at != null && r.checked_out_at == null,
  }));

  return NextResponse.json({
    scope,
    hours,
    totals: totalHours(rows as unknown as VolunteerHoursRow[]),
    opportunities: [...oppById.entries()].map(([id, o]) => ({ id, title: o.title, orgName: o.orgName })),
  });
}
