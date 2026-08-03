import { boundedQuery } from '../../../lib/query-timeout';
import 'server-only';
import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Backups & Recovery | CharitMe Admin' };

// ─────────────────────────────────────────────────────────────────────────────
// Backups & Recovery (design #171).
//
// ⚠️ READ THIS BEFORE ADDING NUMBERS TO THIS PAGE.
//
// The design shows a backup table — "Database Backup, Full, 2.4 GB, Completed",
// last-backup time, total count, storage used. **None of that is observable from
// this application.** Postgres backups are managed by Supabase; this codebase
// has no API to them, no credentials for them, and no way to confirm one ran.
// Every figure in that mock would have to be invented.
//
// A backups dashboard that displays fabricated success rows is worse than no
// page: it is the screen someone checks *during an incident*, and it would
// answer the one question that matters — "do we have a restore point?" — with a
// number nobody measured. So this page reports the backup POSTURE, which is true
// and useful, and links to the provider console for live state.
//
// What it does show live is the part CharitMe genuinely owns: whether anything
// is actively deleting data (retention), and how recently that ran. That is the
// half of "can we recover?" that lives in this codebase.
//
// If a Supabase Management API token is ever provisioned, the live backup list
// belongs here — as measured values, replacing this notice, not alongside it.
// ─────────────────────────────────────────────────────────────────────────────

type RetentionRun = {
  id: string;
  category: string;
  deleted_count: number;
  dry_run: boolean;
  ran_at: string;
};

export default async function BackupsPage() {
  // Deletion activity is the piece of recovery posture this app can actually
  // measure. `null` means unknown — never rendered as "nothing was deleted".
  const { data, error } = await boundedQuery(() => supabaseAdmin
    .from('data_retention_runs')
    .select('id, category, deleted_count, dry_run, ran_at')
    .eq('dry_run', false)
    .gt('deleted_count', 0)
    .order('ran_at', { ascending: false })
    .limit(10));

  const deletions: RetentionRun[] | null = error ? null : ((data ?? []) as RetentionRun[]);

  const card: React.CSSProperties = {
    border: '1px solid var(--b2)',
    borderRadius: 'var(--rl)',
    padding: 18,
    background: 'var(--s1)',
  };

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 880 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22 }}>Backups &amp; Recovery</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--t3)', fontSize: 14 }}>
          Where CharitMe&apos;s data lives, how it is backed up, and how to restore it.
        </p>
      </header>

      <div
        role="note"
        style={{
          border: '1px solid var(--b2)',
          borderLeft: '3px solid var(--blue)',
          borderRadius: 'var(--r)',
          padding: '12px 14px',
          background: 'var(--s2)',
          fontSize: 14,
          color: 'var(--t2)',
        }}
      >
        <strong style={{ color: 'var(--t1)' }}>Backup state is not readable from here.</strong>{' '}
        Postgres backups are taken and held by Supabase. This application has no API access to them,
        so rather than show backup sizes and timestamps it cannot verify, this page documents the
        arrangement and links to the console that holds the live state. If you need to confirm a
        restore point right now, use the link below — not this screen.
      </div>

      <section style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Where the data is</h2>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, fontSize: 14 }}>
          <div>
            <dt style={{ color: 'var(--t3)', fontSize: 12 }}>Primary database</dt>
            <dd style={{ margin: 0 }}>Supabase-managed PostgreSQL. Backups, retention window and
              point-in-time recovery are governed by the Supabase plan.</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--t3)', fontSize: 12 }}>Uploaded files</dt>
            <dd style={{ margin: 0 }}>Supabase Storage buckets — campaign media, verification
              documents and grant attachments.</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--t3)', fontSize: 12 }}>Schema</dt>
            <dd style={{ margin: 0 }}>
              Versioned in the repository under <code>supabase/migrations/</code>, with a generated
              mirror at <code>supabase/schema.sql</code>. The schema can be rebuilt from source
              independently of any database backup.
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--t3)', fontSize: 12 }}>Payment records</dt>
            <dd style={{ margin: 0 }}>
              Stripe holds the authoritative record of every charge, refund and transfer. A database
              restore does not lose payment history — it is reconciled against Stripe by the ledger
              job.
            </dd>
          </div>
        </dl>
      </section>

      <section style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Live state lives in the provider console</h2>
        <p style={{ fontSize: 14, color: 'var(--t2)', margin: '0 0 10px' }}>
          Backup list, retention window, and point-in-time restore are all in the Supabase dashboard
          under <strong>Database → Backups</strong>.
        </p>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--violet-ink)', fontWeight: 700, fontSize: 14 }}
        >
          Open the Supabase dashboard →
        </a>
      </section>

      <section style={card}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>What is deleting data</h2>
        <p style={{ fontSize: 14, color: 'var(--t2)', margin: '0 0 10px' }}>
          The one part of recovery posture this application does control: whether anything is
          actively removing records.{' '}
          <Link href="/admin/retention" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
            Data retention settings
          </Link>
        </p>
        {deletions === null ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
            Deletion history could not be read, so this page cannot confirm whether anything has been
            removed. That is <strong>unknown</strong>, not &ldquo;nothing&rdquo;.
          </p>
        ) : deletions.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
            No retention job has deleted any records. Deleting requires two explicit opt-ins, so this
            is the expected state unless someone enabled it deliberately.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {deletions.map((r) => (
              <li key={r.id} style={{ fontSize: 13, color: 'var(--t2)' }}>
                <strong style={{ color: 'var(--t1)' }}>{r.category}</strong> — {r.deleted_count}{' '}
                records deleted · {new Date(r.ran_at).toUTCString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
