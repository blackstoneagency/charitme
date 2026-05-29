import 'server-only';
import Link from 'next/link';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { KindFundShell, TopBar } from '../../../components/KindFundShellServer';
import ApplySchemaButton from './_components/ApplySchemaButton';

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

  const envVars: [string, string | undefined][] = [
    ['NEXT_PUBLIC_SUPABASE_URL',      process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY',     process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['STRIPE_SECRET_KEY',             process.env.STRIPE_SECRET_KEY],
    ['STRIPE_WEBHOOK_SECRET',         process.env.STRIPE_WEBHOOK_SECRET],
    ['NEXT_PUBLIC_APP_URL',           process.env.NEXT_PUBLIC_APP_URL],
    ['OPENAI_API_KEY (optional)',      process.env.OPENAI_API_KEY],
    ['RESEND_API_KEY (optional)',      process.env.RESEND_API_KEY],
  ];

  for (const [name, value] of envVars) {
    const optional = name.includes('optional');
    checks.push({
      label: name,
      status: value ? 'ok' : optional ? 'empty' : 'missing',
      value: value ? `set (${value.slice(0, 8)}…)` : 'NOT SET',
      fix: !value && !optional ? `Set ${name} in Vercel → Settings → Environment Variables` : undefined,
    });
  }

  const tables = ['profiles', 'campaigns', 'donations', 'recurring_donations', 'payouts', 'webhook_events', 'platform_settings'];
  for (const table of tables) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        const tableNotFound = !error.code || error.message?.includes('does not exist') || error.message?.includes('relation');
        checks.push({
          label: `DB: ${table}`,
          status: 'error',
          value: tableNotFound ? 'TABLE MISSING' : `${error.code}: ${error.message}`,
          fix: tableNotFound ? '→ Click "Apply Schema Now" above' : 'Check RLS policies',
        });
      } else {
        checks.push({
          label: `DB: ${table}`,
          status: (count ?? 0) > 0 ? 'ok' : 'empty',
          value: `${count ?? 0} rows`,
        });
      }
    } catch (e) {
      checks.push({
        label: `DB: ${table}`,
        status: 'error',
        value: e instanceof Error ? e.message.slice(0, 60) : 'Unknown error',
        fix: 'Check SUPABASE_SERVICE_ROLE_KEY',
      });
    }
  }
  return checks;
}

const STATUS_STYLE: Record<CheckStatus, { bg: string; color: string; icon: string }> = {
  ok:      { bg: 'transparent', color: '#065f46', icon: '✓' },
  empty:   { bg: '#fffbeb',     color: '#92400e', icon: '○' },
  error:   { bg: '#fff0f3',     color: '#be123c', icon: '✗' },
  missing: { bg: '#fff0f3',     color: '#be123c', icon: '✗' },
};

export default async function AdminSetupPage() {
  await requireAdmin();
  const checks = await runChecks();

  const errors  = checks.filter(c => c.status === 'error' || c.status === 'missing');
  const empties = checks.filter(c => c.status === 'empty');
  const ok      = checks.filter(c => c.status === 'ok');
  const tablesOk = checks.filter(c => c.label.startsWith('DB:') && c.status === 'ok').length;
  const tableMissing = checks.filter(c => c.label.startsWith('DB:') && (c.status === 'error' || c.status === 'missing')).length;

  return (
    <KindFundShell active="Dashboard" mode="admin">
      <TopBar
        title="Setup Diagnostic"
        subtitle="Check environment variables, database connectivity, and table status."
        actions={
          <Link href="/admin" style={{ textDecoration: 'none', fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>
            ← Dashboard
          </Link>
        }
      />

      <div style={{ padding: '0 32px 40px', maxWidth: 820 }}>
        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Passing',  count: ok.length,      bg: '#f0fff8', color: '#065f46' },
            { label: 'Warnings', count: empties.length,  bg: '#fffbeb', color: '#92400e' },
            { label: 'Errors',   count: errors.length,   bg: '#fff0f3', color: '#be123c' },
          ].map(s => (
            <div key={s.label} style={{ padding: '14px 18px', background: s.bg, borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* One-click apply */}
        {tableMissing > 0 && (
          <div style={{ padding: '22px 26px', background: '#fff0f3', border: '2px solid #fca5a5', borderRadius: 16, marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#be123c', margin: '0 0 8px' }}>
              ❌ {tableMissing} table{tableMissing !== 1 ? 's' : ''} missing — Schema not applied
            </h3>
            <p style={{ fontSize: 14, color: '#7f1d1d', margin: '0 0 18px', lineHeight: 1.6 }}>
              The KindFund database schema has never been run against this Supabase project.
              Click the button below to apply it automatically — no SQL editor needed.
            </p>
            <ApplySchemaButton />
            <p style={{ fontSize: 12, color: '#be123c', margin: '12px 0 0', lineHeight: 1.5 }}>
              This creates all tables, enables RLS, sets up triggers, and bootstraps platform settings.
              Safe to run multiple times — uses <code>CREATE TABLE IF NOT EXISTS</code>.
            </p>
          </div>
        )}

        {tableMissing === 0 && tablesOk > 0 && (
          <div style={{ padding: '16px 22px', background: '#f0fff8', border: '1.5px solid #bbf7d0', borderRadius: 14, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#065f46', margin: 0 }}>
              ✅ All {tablesOk} tables present — database is connected and ready
            </h3>
          </div>
        )}

        {/* Checks list */}
        <section style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--b2)', overflow: 'hidden' }}>
          {checks.map((check, i) => {
            const s = STATUS_STYLE[check.status];
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, padding: '13px 20px', borderBottom: i < checks.length - 1 ? '1px solid var(--b1)' : 'none', background: check.status !== 'ok' ? s.bg : undefined, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: s.color, paddingTop: 1 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', fontFamily: 'monospace' }}>{check.label}</div>
                  {check.fix && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>
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
        <div style={{ marginTop: 22, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="/api/health" target="_blank" style={{ padding: '9px 20px', background: '#6c35ff', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            /api/health →
          </a>
          <a href="https://supabase.com/dashboard/project/nengpvscsgukotheptri/editor" target="_blank" rel="noopener noreferrer" style={{ padding: '9px 20px', background: 'var(--s3)', border: '1px solid var(--b2)', color: 'var(--t1)', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Supabase SQL Editor ↗
          </a>
          <Link href="/create" style={{ padding: '9px 20px', background: 'var(--green)', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Create Campaign →
          </Link>
        </div>
      </div>
    </KindFundShell>
  );
}
