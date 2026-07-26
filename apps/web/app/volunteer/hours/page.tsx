import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { totalHours } from '../../../lib/volunteer-shifts-core';
import HoursClient, { type HoursRow } from './HoursClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My volunteer hours',
  description: 'Check in to a shift, log your time, and see which hours have been verified.',
};

export default async function VolunteerHoursPage() {
  const user = await requireUser();

  // Never fabricate an empty history from a failed read — the dashboards were
  // fixed to stop doing exactly that. `loadFailed` drives an explicit banner.
  let rows: HoursRow[] = [];
  let loadFailed = false;
  try {
    const { data, error } = await supabaseAdmin
      .from('volunteer_hours')
      .select('id, opportunity_id, shift_id, checked_in_at, checked_out_at, hours, status, source')
      .eq('volunteer_user_id', user.id)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(200);
    if (error) loadFailed = true;
    else rows = (data ?? []) as HoursRow[];
  } catch {
    loadFailed = true;
  }

  // Titles for context. A failure here is cosmetic, so it degrades to the id
  // rather than failing the page.
  const titleById = new Map<string, string>();
  if (rows.length > 0) {
    const ids = [...new Set(rows.map((r) => r.opportunity_id))];
    try {
      const { data } = await supabaseAdmin
        .from('volunteer_opportunities')
        .select('id, title')
        .in('id', ids);
      for (const o of data ?? []) titleById.set(o.id as string, o.title as string);
    } catch { /* labels only */ }
  }

  const totals = totalHours(rows);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 900 }}>
      <div style={{ marginBottom: 8 }}>
        <Link href="/volunteer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textDecoration: 'none' }}>
          ← Volunteer opportunities
        </Link>
      </div>
      <h1 style={{ fontSize: 'clamp(24px,4vw,32px)', fontWeight: 900, margin: '0 0 6px', color: 'var(--t1)' }}>
        My volunteer hours
      </h1>
      <p style={{ color: 'var(--t2)', margin: '0 0 24px', fontSize: 15 }}>
        Check in when you arrive, check out when you finish. Your organizer verifies the time
        before it can be exported.
      </p>

      {loadFailed && (
        <div
          role="alert"
          style={{
            border: '1px solid var(--b2)', borderRadius: 12, padding: '12px 16px',
            marginBottom: 20, color: 'var(--t1)', background: 'var(--s2)', fontSize: 14,
          }}
        >
          We couldn&apos;t load your hours just now. This is a display problem — nothing has been
          lost. Refresh in a moment.
        </div>
      )}

      <HoursClient
        rows={rows}
        titles={Object.fromEntries(titleById)}
        totals={totals}
        loadFailed={loadFailed}
      />
    </div>
  );
}
