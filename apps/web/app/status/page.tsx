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

async function probe(fn: () => Promise<unknown>): Promise<ProbeResult> {
  const started = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
  }
}

async function collect(): Promise<Subsystem[]> {
  const out: Subsystem[] = [
    { key: 'website', label: 'Website', description: 'Pages and navigation', state: 'operational' },
  ];

  const dbProbe = await probe(async () => {
    const { error } = await supabaseAdmin.from('campaigns').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.code ?? 'query failed');
  });
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

  const authProbe = await probe(async () => {
    const { error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.code ?? 'query failed');
  });
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
  degraded: { dot: '#f59e0b', text: '#b45309', label: 'Degraded' },
  down: { dot: 'var(--red)', text: 'var(--red-text)', label: 'Down' },
};

export default async function StatusPage() {
  const subsystems = await collect();
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
