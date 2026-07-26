import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { createClient } from '../../../../../lib/supabase-server';
import { isAdmin } from '../../../../../lib/roles';
import { toCsv } from '../../../../../lib/csv';
import { exportableHours, totalHours } from '../../../../../lib/volunteer-shifts-core';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 5_000;

// GET /api/volunteers/hours/export — CSV of VERIFIED volunteer hours, for
// corporate volunteer-matching programs.
//
// Two modes, and the difference is who is allowed to see whose time:
//   ?opportunity_id=…  the organizer (or an admin) exports that opportunity's
//                      hours, including volunteer names — they run the program
//                      and already know who turned up.
//   no parameter       the signed-in volunteer exports their own hours only.
//
// There is deliberately no "export everything" mode: an employer-facing report
// should be scoped to one program or one person, not to the platform.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const opportunityId = request.nextUrl.searchParams.get('opportunity_id');
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  let query = supabaseAdmin
    .from('volunteer_hours')
    .select('id, opportunity_id, volunteer_user_id, hours, status, checked_in_at, checked_out_at, deleted_at')
    .eq('status', 'verified')
    .is('deleted_at', null)
    .order('checked_in_at', { ascending: true })
    .limit(MAX_ROWS);

  let scope: 'opportunity' | 'self';
  if (opportunityId) {
    const { data: opp } = await supabaseAdmin
      .from('volunteer_opportunities')
      .select('id, created_by, title, org_name')
      .eq('id', opportunityId)
      .maybeSingle();
    if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (opp.created_by !== user.id && !(await isAdmin(user.id, user.email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    scope = 'opportunity';
    query = query.eq('opportunity_id', opportunityId);
  } else {
    scope = 'self';
    query = query.eq('volunteer_user_id', user.id);
  }

  if (from) query = query.gte('checked_in_at', from);
  if (to) query = query.lte('checked_in_at', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });

  const rows = data ?? [];

  // Filtered again through the shared rule rather than trusting the query alone.
  // The predicate that decides what an employer sees lives in one tested place;
  // a future change to the query cannot quietly widen it.
  const eligible = exportableHours(rows as Parameters<typeof exportableHours>[0]);

  // Names only for the organizer view. A volunteer exporting their own hours
  // does not need their name echoed back, and not fetching it keeps this route
  // from touching profile data it has no use for.
  const nameById = new Map<string, { full_name: string | null; email: string | null }>();
  if (scope === 'opportunity' && eligible.length > 0) {
    const ids = [...new Set(eligible.map((r) => r.volunteerUserId))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);
    for (const p of profiles ?? []) {
      nameById.set(p.id as string, { full_name: p.full_name as string | null, email: p.email as string | null });
    }
  }

  const headers = scope === 'opportunity'
    ? ['date', 'volunteer_name', 'volunteer_email', 'opportunity_id', 'hours']
    : ['date', 'opportunity_id', 'hours'];

  const csvRows = eligible.map((r) => {
    const base: Record<string, unknown> = {
      date: r.date ?? '',
      opportunity_id: r.opportunityId,
      hours: r.hours.toFixed(2),
    };
    if (scope === 'opportunity') {
      const p = nameById.get(r.volunteerUserId);
      base.volunteer_name = p?.full_name ?? '';
      base.volunteer_email = p?.email ?? '';
    }
    return base;
  });

  // toCsv escapes formula-injection leads — these cells carry volunteer-supplied
  // names, which land in Excel.
  const csv = toCsv(csvRows, headers);
  const totals = totalHours(rows as Parameters<typeof totalHours>[0]);
  const filename = scope === 'opportunity' ? `volunteer-hours-${opportunityId}.csv` : 'my-volunteer-hours.csv';

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Verified total, so a consumer can reconcile the file without re-summing
      // and without seeing pending time as if it counted.
      'X-Verified-Hours': String(totals.verified),
      'X-Row-Count': String(csvRows.length),
    },
  });
}
