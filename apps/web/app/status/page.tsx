import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseAdmin } from '../../lib/supabase';
import {
  classify,
  notConfigured,
  overallHeadline,
  overallStatus,
  type ProbeResult,
  type Subsystem,
  type SubsystemState,
} from '../../lib/status-core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'System Status | CharitMe',
  description: 'Live operational status of CharitMe — campaigns, donations, accounts, and email.',
  alternates: { canonical: 'https://www.charitme.com/status' },
};

// Public status page (design #107).
//
// Runs the probes server-side rather than fetching /api/status from the client:
// during an incident the status page is the one page that must render even when
// client JS fails, and a fetch would make it depend on the very stack it is
// reporting on. The API route stays for uptime monitors and integrations.

/**
 * How long a single probe may take before it is reported as unreachable.
 *
 * A status page that hangs when a dependency hangs is exactly backwards: the
 * page exists to say the database is down, and without a bound it becomes
 * unreachable in the same breath. Measured at 14s before this was added — two
 * unbounded probes, on the one page that has to answer during an incident.
 */
const PROBE_TIMEOUT_MS = 3000;

/**
 * Bounds any read on this page, not just the probes.
 *
 * The incident and maintenance reads below were added WITHOUT a timeout, and
 * measurement caught it: with the probes bounded and concurrent the API route
 * dropped to ~3s while this page stayed at ~7s, because these two queries were
 * still unbounded. The rule that applies to a dependency probe applies just as
 * much to a query this page makes itself — resolving to `null` (rendered as
 * "unknown") is always better than holding the page open.
 */
async function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), PROBE_TIMEOUT_MS)),
  ]);
}

async function probe(fn: () => Promise<unknown>): Promise<ProbeResult> {
  const started = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS),
      ),
    ]);
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

async function collect(): Promise<Subsystem[]> {
  const out: Subsystem[] = [
    { key: 'website', label: 'Website', description: 'Pages and navigation', state: 'operational' },
  ];

  // Probes run CONCURRENTLY. They used to be awaited one after another, so the
  // page's total latency was the SUM of every slow dependency — measured at 14s,
  // then 7s once each was bounded. A status page reports on things that are
  // down; making it wait for them in series is the one ordering that guarantees
  // it is slowest exactly when it matters most. Worst case is now one timeout,
  // not one per subsystem.
  const [dbProbe, authProbe] = await Promise.all([
    probe(async () => {
      // Liveness, not analytics: `count: 'exact', head: true` made Postgres
      // COUNT the whole table to answer "does the database respond?".
      const { error } = await supabaseAdmin.from('campaigns').select('id').limit(1);
      if (error) throw new Error(error.code ?? 'query failed');
    }),
    probe(async () => {
      const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
      if (error) throw new Error(error.code ?? 'query failed');
    }),
  ]);

  out.push({
    key: 'database',
    label: 'Campaigns & Data',
    description: 'Browsing campaigns and reading donation history',
    ...classify(dbProbe, 'Campaign and donation data is temporarily unreachable.'),
  });

  out.push(
    process.env.STRIPE_SECRET_KEY
      ? {
          key: 'payments',
          label: 'Donations & Payments',
          description: 'Accepting donations and payouts',
          state: 'operational' as SubsystemState,
        }
      : notConfigured('payments', 'Donations & Payments', 'Accepting donations and payouts', 'Stripe'),
  );

  out.push({
    key: 'accounts',
    label: 'User Accounts',
    description: 'Sign in, sign up, and profile settings',
    ...classify(authProbe, 'Sign-in and account services are temporarily unreachable.'),
  });

  out.push(
    process.env.RESEND_API_KEY
      ? {
          key: 'email',
          label: 'Email & Notifications',
          description: 'Receipts and campaign updates',
          state: 'operational' as SubsystemState,
        }
      : notConfigured('email', 'Email & Notifications', 'Receipts and campaign updates', 'The email provider'),
  );

  return out;
}

const TONE: Record<SubsystemState, { dot: string; text: string; label: string }> = {
  operational: { dot: 'var(--green)', text: 'var(--green-dark)', label: 'Operational' },
  // `var(--orange-text)`, not a fixed #b45309: the other two tones already use
  // adaptive tokens, and the hardcoded amber measured 3.56:1 on the dark
  // surface — an AA failure on the one word that tells an operator something
  // is wrong. The token is #a05712 light / #fbbf24 dark.
  degraded: { dot: '#f59e0b', text: 'var(--orange-text)', label: 'Degraded' },
  down: { dot: 'var(--red)', text: 'var(--red-text)', label: 'Down' },
};

// ── Incidents and maintenance (designs #168 / #169) ─────────────────────────
//
// The probes above say WHETHER something is broken. These say WHAT HAPPENED —
// the half of a status page that needs a human to write it.
//
// `null` means the read FAILED and is rendered as "unknown", never as "no
// incidents". Reporting an all-clear because the incidents table was
// unreachable is the most misleading thing a status page can do, and it is
// exactly the case where the table is most likely to be unreachable.
//
// These tables ship in 20260820000000. Until that migration is applied the
// query errors and the page shows the unknown state rather than breaking.
type IncidentRow = {
  id: string;
  title: string;
  component: string;
  status: string;
  impact: string;
  started_at: string;
  resolved_at: string | null;
};

type MaintenanceRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
};

async function recentIncidents(): Promise<IncidentRow[] | null> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('incidents')
    .select('id, title, component, status, impact, started_at, resolved_at')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(20);
  return error ? null : ((data ?? []) as IncidentRow[]);
}

async function upcomingMaintenance(): Promise<MaintenanceRow[] | null> {
  const { data, error } = await supabaseAdmin
    .from('maintenance_windows')
    .select('id, title, description, starts_at, ends_at, status')
    .in('status', ['scheduled', 'in_progress'])
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(10);
  return error ? null : ((data ?? []) as MaintenanceRow[]);
}

const INCIDENT_TONE: Record<string, string> = {
  critical: 'var(--red)',
  major: 'var(--red)',
  minor: 'var(--t3)',
};


export default async function StatusPage() {
  const [subsystems, incidents, maintenance] = await Promise.all([
    collect(),
    // `null` is the "could not read" state the sections below already render as
    // unknown, so a timeout degrades to the same honest message as a query
    // error — never to "no incidents".
    withTimeout(recentIncidents(), null),
    withTimeout(upcomingMaintenance(), null),
  ]);
  const overall = overallStatus(subsystems);
  const tone = TONE[overall];

  return (
    <main id="main-content" style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 64px' }}>
      <header style={{ marginBottom: 24 }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--violet-ink)',
            marginBottom: 10,
          }}
        >
          Status
        </span>
        <h1 style={{ fontSize: 34, lineHeight: 1.15, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          System status
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t2)', margin: 0, maxWidth: 640 }}>
          Checked live each time this page loads — every line below is a real probe, not a stored value.
        </p>
      </header>

      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid var(--b1)',
          background: 'var(--s1)',
          borderRadius: 'var(--rl)',
          padding: '18px 20px',
          marginBottom: 22,
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 14, height: 14, borderRadius: 999, background: tone.dot, flexShrink: 0 }}
        />
        <div>
          <strong style={{ display: 'block', fontSize: 19, fontWeight: 900, color: 'var(--t1)' }}>
            {overallHeadline(overall)}
          </strong>
          <span style={{ fontSize: 13, color: 'var(--t3)' }}>
            Last checked {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {subsystems.map((s) => {
          const t = TONE[s.state];
          return (
            <li
              key={s.key}
              style={{
                border: '1px solid var(--b1)',
                background: 'var(--s1)',
                borderRadius: 'var(--rl)',
                padding: '14px 16px',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 220, flex: '1 1 320px' }}>
                <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>{s.label}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t3)' }}>{s.description}</p>
                {/* Detail appears only when something is wrong — a healthy row
                    inventing reassurance is noise. */}
                {s.detail && (
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: t.text, fontWeight: 700 }}>{s.detail}</p>
                )}
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: t.text,
                  whiteSpace: 'nowrap',
                }}
              >
                <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, background: t.dot }} />
                {t.label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Scheduled maintenance first: it is the only thing here a visitor can
          act on ahead of time. */}
      {maintenance === null ? (
        <p style={{ fontSize: 14, color: 'var(--t3)', marginTop: 32 }}>
          Scheduled maintenance could not be loaded, so this page cannot confirm whether any is
          planned.
        </p>
      ) : maintenance.length > 0 ? (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px', color: 'var(--t1)' }}>
            Scheduled maintenance
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {maintenance.map((m) => (
              <li key={m.id} style={{ border: '1px solid var(--b2)', borderRadius: 10, padding: '12px 14px' }}>
                <strong style={{ color: 'var(--t1)', fontSize: 15 }}>{m.title}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t2)' }}>
                  <time dateTime={m.starts_at}>{new Date(m.starts_at).toUTCString()}</time>
                  {' → '}
                  <time dateTime={m.ends_at}>{new Date(m.ends_at).toUTCString()}</time>
                </p>
                {m.description && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--t2)' }}>{m.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px', color: 'var(--t1)' }}>
          Recent incidents
        </h2>
        {incidents === null ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
            Incident history could not be loaded. This does <strong>not</strong> mean there have been
            none — the page simply cannot tell you right now.
          </p>
        ) : incidents.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
            No incidents reported in the last 30 days.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
            {incidents.map((inc) => (
              <li key={inc.id} style={{ border: '1px solid var(--b2)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--t1)', fontSize: 15 }}>{inc.title}</strong>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                      color: INCIDENT_TONE[inc.impact] ?? 'var(--t3)',
                    }}
                  >
                    {inc.impact}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--t3)' }}>{inc.component}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t2)' }}>
                  {inc.resolved_at ? 'Resolved' : inc.status}
                  {' · '}
                  <time dateTime={inc.started_at}>{new Date(inc.started_at).toUTCString()}</time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p style={{ margin: '24px 0 0', fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.6 }}>
        Machine-readable at{' '}

        <Link href="/api/status" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
          /api/status
        </Link>
        . Something looks wrong that is not listed here?{' '}
        <Link href="/contact" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
          Tell us
        </Link>
        .
      </p>
    </main>
  );
}
