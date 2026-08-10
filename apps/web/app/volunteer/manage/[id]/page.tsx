import { boundedQuery } from '../../../../lib/query-timeout';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '../../../../lib/auth';
import { isAdmin } from '../../../../lib/roles';
import { supabaseAdmin } from '../../../../lib/supabase';
import ManageClient, { type ManageShift, type PendingEntry } from './ManageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Manage volunteer shifts',
  description: 'Schedule shifts, share check-in codes, and verify volunteer hours.',
};

export default async function ManageShiftsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const { data: opp } = await boundedQuery(() => supabaseAdmin
    .from('volunteer_opportunities')
    .select('id, title, org_name, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle());
  if (!opp) notFound();

  // Ownership is checked here as well as in the API. A page that renders
  // check-in codes must not be reachable by someone who cannot create them —
  // the codes are the whole security of the check-in flow.
  const admin = await isAdmin(user.id, user.email);
  if (opp.created_by !== user.id && !admin) redirect('/volunteer');

  let shifts: ManageShift[] = [];
  let pending: PendingEntry[] = [];
  let loadFailed = false;

  try {
    const [shiftRes, hoursRes] = await Promise.all([
      supabaseAdmin
        .from('volunteer_shifts')
        .select('id, title, starts_at, ends_at, location, capacity, filled_count, status, checkin_code')
        .eq('opportunity_id', id)
        .is('deleted_at', null)
        .order('starts_at', { ascending: true })
        .limit(200),
      supabaseAdmin
        .from('volunteer_hours')
        .select('id, volunteer_user_id, checked_in_at, checked_out_at, hours, status')
        .eq('opportunity_id', id)
        .eq('status', 'pending')
        .not('checked_out_at', 'is', null)
        .is('deleted_at', null)
        .order('checked_in_at', { ascending: false })
        .limit(200),
    ]);
    if (shiftRes.error || hoursRes.error) loadFailed = true;
    shifts = (shiftRes.data ?? []) as ManageShift[];

    const rawHours = (hoursRes.data ?? []) as Omit<PendingEntry, 'volunteer_name'>[];
    const ids = [...new Set(rawHours.map((h) => h.volunteer_user_id))];
    const nameById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', ids);
      for (const p of profiles ?? []) nameById.set(p.id as string, (p.full_name as string | null) ?? 'A volunteer');
    }
    pending = rawHours.map((h) => ({ ...h, volunteer_name: nameById.get(h.volunteer_user_id) ?? 'A volunteer' }));
  } catch {
    loadFailed = true;
  }

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 980 }}>
      <div style={{ marginBottom: 8 }}>
        <Link href="/volunteer" className="cm-touch-link" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textDecoration: 'none' }}>
          ← Volunteer opportunities
        </Link>
      </div>
      <h1 style={{ fontSize: 'clamp(24px,4vw,32px)', fontWeight: 900, margin: '0 0 4px', color: 'var(--t1)' }}>
        {opp.title}
      </h1>
      <p style={{ color: 'var(--t2)', margin: '0 0 24px', fontSize: 15 }}>
        {opp.org_name} · Schedule shifts, share the check-in code, and verify hours before they
        can be exported.
      </p>

      {loadFailed && (
        <div
          role="alert"
          style={{
            border: '1px solid var(--b2)', borderRadius: 12, padding: '12px 16px',
            marginBottom: 20, color: 'var(--t1)', background: 'var(--s2)', fontSize: 14,
          }}
        >
          Some of this page couldn&apos;t be loaded. What you see may be incomplete — refresh
          before verifying anything.
        </div>
      )}

      <ManageClient opportunityId={id} shifts={shifts} pending={pending} />
    </div>
  );
}
