import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import {
  classify,
  notConfigured,
  overallStatus,
  type ProbeResult,
  type Subsystem,
} from '../../../lib/status-core';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Public status. Distinct from /api/health, which returns a liveness ping and
// gates real diagnostics behind an admin session — a status page cannot use it.
//
// ⚠️ WHAT THIS DELIBERATELY DOES NOT EXPOSE: row counts, key values, key modes,
// environment names, error messages from the database. It answers "is it
// working", not "what is it". `/api/health?details=1` remains the operator view
// and stays admin-only.
//
// Every subsystem is PROBED. Nothing is hardcoded green — see lib/status-core.
// ─────────────────────────────────────────────────────────────────────────────

async function probe(fn: () => Promise<unknown>): Promise<ProbeResult> {
  const started = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const subsystems: Subsystem[] = [];

  // ── Website ───────────────────────────────────────────────────────────────
  // If this handler is executing, the web tier is serving. Reported as measured
  // rather than assumed: the request that produced this response IS the check.
  subsystems.push({
    key: 'website',
    label: 'Website',
    description: 'Pages and navigation',
    state: 'operational',
  });

  // ── Database ──────────────────────────────────────────────────────────────
  // A HEAD count against a public table: cheap, indexed, and it exercises the
  // same PostgREST path every page uses.
  const dbProbe = await probe(async () => {
    const { error } = await supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.code ?? 'query failed');
  });
  const db = classify(dbProbe, 'Campaign and donation data is temporarily unreachable.');
  subsystems.push({
    key: 'database',
    label: 'Campaigns & Data',
    description: 'Browsing campaigns and reading donation history',
    ...db,
  });

  // ── Payments ──────────────────────────────────────────────────────────────
  // Configuration only — no live call to Stripe. A status page must not add
  // traffic to the payment processor on every visit, and a network hop to a
  // third party would make this endpoint as slow and flaky as that hop.
  if (!process.env.STRIPE_SECRET_KEY) {
    subsystems.push(
      notConfigured('payments', 'Donations & Payments', 'Accepting donations and payouts', 'Stripe'),
    );
  } else {
    subsystems.push({
      key: 'payments',
      label: 'Donations & Payments',
      description: 'Accepting donations and payouts',
      state: 'operational',
    });
  }

  // ── Accounts ──────────────────────────────────────────────────────────────
  const authProbe = await probe(async () => {
    const { error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.code ?? 'query failed');
  });
  const auth = classify(authProbe, 'Sign-in and account services are temporarily unreachable.');
  subsystems.push({
    key: 'accounts',
    label: 'User Accounts',
    description: 'Sign in, sign up, and profile settings',
    ...auth,
  });

  // ── Email ─────────────────────────────────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    subsystems.push(
      notConfigured('email', 'Email & Notifications', 'Receipts and campaign updates', 'The email provider'),
    );
  } else {
    subsystems.push({
      key: 'email',
      label: 'Email & Notifications',
      description: 'Receipts and campaign updates',
      state: 'operational',
    });
  }

  const overall = overallStatus(subsystems);

  return NextResponse.json(
    { status: overall, checkedAt: new Date().toISOString(), subsystems },
    {
      // Short shared cache: a status page is the first thing hit during an
      // incident, so it must not amplify load — but stale-by-minutes would
      // report an outage as healthy, which defeats the point.
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' },
      status: 200,
    },
  );
}
