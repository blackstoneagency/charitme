import 'server-only';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import IncidentsClient, { type Incident, type MaintenanceWindow } from './IncidentsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Incidents & Maintenance | CharitMe Admin' };

// ─────────────────────────────────────────────────────────────────────────────
// Incidents (#168) and Scheduled Maintenance (#169).
//
// These are the WRITE side of the public /status page. That page could already
// probe whether a subsystem responds; what it could not do is say what happened
// or that anyone was aware — which is the thing a user actually wants when they
// see a red dot.
//
// ⚠️ `incidents`, `incident_updates` and `maintenance_windows` ship in
// 20260820000000, which is NOT applied to production yet (see the migrations
// runbook). Until it is, both reads below fail and the page renders its unknown
// state rather than an empty list — the same rule the public page follows, and
// for the same reason: "no incidents" and "cannot tell" are opposite claims.
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminIncidentsPage() {
  const [incidentsRes, windowsRes] = await Promise.all([
    supabaseAdmin
      .from('incidents')
      .select('id, title, component, status, impact, started_at, resolved_at, created_at, updated_at')
      .order('started_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('maintenance_windows')
      .select('id, title, description, component, starts_at, ends_at, status, created_at, updated_at')
      .order('starts_at', { ascending: false })
      .limit(100),
  ]);

  const incidents: Incident[] | null = incidentsRes.error
    ? null
    : ((incidentsRes.data ?? []) as Incident[]);
  const windows: MaintenanceWindow[] | null = windowsRes.error
    ? null
    : ((windowsRes.data ?? []) as MaintenanceWindow[]);

  return <IncidentsClient initialIncidents={incidents} initialWindows={windows} />;
}
