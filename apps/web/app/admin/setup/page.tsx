import 'server-only';
import Link from 'next/link';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';

export const dynamic = 'force-dynamic';

type CheckStatus = 'ok' | 'empty' | 'error' | 'missing';

type Check = {
  label: string;
  status: CheckStatus;
  value: string;
  fix?: string;
};

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // ENV VARS
  const envVars = [
    ['NEXT_PUBLIC_SUPABASE_URL',     process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY',    process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['STRIPE_SECRET_KEY',            process.env.STRIPE_SECRET_KEY],
    ['STRIPE_WEBHOOK_SECRET',        process.env.STRIPE_WEBHOOK_SECRET],
    ['NEXT_PUBLIC_APP_URL',          process.env.NEXT_PUBLIC_APP_URL],
    ['OPENAI_API_KEY (optional)',     process.env.OPENAI_API_KEY],
    ['RESEND_API_KEY (optional)',     process.env.RESEND_API_KEY],
  ] as [string, string | undefined][];

  for (const [name, value] of envVars) {
    const optional = name.includes('optional');
    checks.push({
      label: name,
      status: value ? 'ok' : optional ? 'empty' : 'missing',
      value: value ? `set (${value.slice(0, 8)}…)` : 'NOT SET',
      fix: !value && !optional ? `Set ${name} in Vercel → Settings → Environment Variables` : undefined,
    });
  }

  // TABLE CHECKS
  const tables = ['profiles', 'campaigns', 'donations', 'recurring_donations', 'payouts', 'webhook_events', 'platform_settings'];
  for (const table of tables) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        checks.push({
          label: `DB: ${table}`,
          status: 'error',
          value: `${error.code}: ${error.message}`,
          fix: error.code === '42P01'
            ? 'Run schema.sql in Supabase SQL Editor — table does not exist'
            : 'Check Supabase connection and RLS policies',
        });
      } else {
        checks.push({
          label: `DB: ${table}`,
          status: (count ?? 0) > 0 ? 'ok' : 'empty',
          value: `${count ?? 0} rows`,
          fix: (count ?? 0) === 0 && table === 'campaigns'
            ? 'No campaigns yet. Create one at /create or run seed data in Supabase SQL Editor.'
            : undefined,
        });
      }
    } catch (e) {
      checks.push({
        label: `DB: ${table}`,
        status: 'error',
        value: e instanceof Error ? e.message : 'Unknown error',
        fix: 'Check SUPABASE_SERVICE_ROLE_KEY and Supabase connection',
      });
    }
  }

  return checks;
}

const STATUS_STYLE: Record<CheckStatus, { bg: string; color: string; icon: string }> = {
  ok:      { bg: '#f0fff8', color: '#065f46', icon: '✓' },
  empty:   { bg: '#fffbeb', color: '#92400e', icon: '○' },
  error:   { bg: '#fff0f3', color: '#be123c', icon: '✗' },
  missing: { bg: '#fff0f3', color: '#be123c', icon: '✗' },
};

export default async function AdminSetupPage() {
  await requireAdmin();
  const checks = await runChecks();

  const errors  = checks.filter(c => c.status === 'error' || c.status === 'missing');
  const empties = checks.filter(c => c.status === 'empty');
  const ok      = checks.filter(c => c.status === 'ok');

  return (
    <KindFundShell active="Dashboard" mode="admin">
      <TopBar
        title="Setup Diagnostic"
        subtitle="Check environment variables, database connectivity, and table data."
        actions={
          <Link href="/admin" style={{ textDecoration: 'none', fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
            ← Back to Dashboard
          </Link>
        }
      />

      <div style={{ padding: '0 32px 40px', maxWidth: 800 }}>
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Passing', count: ok.length,     bg: '#f0fff8', color: '#065f46' },
            { label: 'Warnings', count: empties.length, bg: '#fffbeb', color: '#92400e' },
            { label: 'Errors',   count: errors.length,  bg: '#fff0f3', color: '#be123c' },
          ].map(s => (
            <div key={s.label} style={{ padding: '16px 20px', background: s.bg, borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div style={{ padding: '16px 20px', background: '#fff0f3', border: '1.5px solid #fecdd3', borderRadius: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#be123c', margin: '0 0 8px' }}>
              ❌ {errors.length} critical issue{errors.length !== 1 ? 's' : ''} must be fixed
            </h3>
            <p style={{ fontSize: 13, color: '#be123c', margin: 0 }}>
              Until these are resolved, data will not flow from Supabase to the admin pages.
            </p>
          </div>
        )}

        {/* Checks list */}
        <section style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--b2)', overflow: 'hidden' }}>
          {checks.map((check, i) => {
            const s = STATUS_STYLE[check.status];
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12, padding: '14px 20px', borderBottom: i < checks.length - 1 ? '1px solid var(--b1)' : 'none', alignItems: 'flex-start', background: check.status !== 'ok' ? s.bg : undefined }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: s.color, paddingTop: 1 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', fontFamily: 'monospace' }}>{check.label}</div>
                  {check.fix && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
                      <strong>Fix:</strong> {check.fix}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: s.color, fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {check.value}
                </div>
              </div>
            );
          })}
        </section>

        {/* Quick actions */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="/api/health" target="_blank"
            style={{ padding: '10px 20px', background: '#6c35ff', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Run /api/health →
          </a>
          <a href="https://supabase.com/dashboard/project/nengpvscsgukotheptri/editor" target="_blank" rel="noopener noreferrer"
            style={{ padding: '10px 20px', background: 'var(--s3)', border: '1px solid var(--b2)', color: 'var(--t1)', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Open Supabase SQL Editor ↗
          </a>
          <Link href="/create"
            style={{ padding: '10px 20px', background: 'var(--green)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Create First Campaign →
          </Link>
        </div>

        {/* Schema instructions */}
        <div style={{ marginTop: 28, padding: '20px 24px', background: 'var(--s2)', borderRadius: 12, border: '1px solid var(--b2)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px' }}>📋 Apply Schema in Supabase SQL Editor</h3>
          <ol style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            <li>Go to <a href="https://supabase.com/dashboard/project/nengpvscsgukotheptri/sql/new" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>Supabase SQL Editor</a></li>
            <li>Open <code>supabase/schema.sql</code> from your project</li>
            <li>Paste the entire file contents and click <strong>Run</strong></li>
            <li>This creates all tables, RLS policies, triggers, and seed data (500 rows/table)</li>
            <li>Return here to verify all checks pass</li>
          </ol>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: '10px 0 0' }}>
            ⚠ The schema starts with <code>drop schema if exists public cascade</code> — only run this on a fresh database or if you intend to wipe all data.
          </p>
        </div>
      </div>
    </KindFundShell>
  );
}
