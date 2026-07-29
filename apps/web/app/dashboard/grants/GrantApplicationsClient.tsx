'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Btn, BtnLink, EmptyState, Spinner } from '../../../components/ui';
import { grantApplicationStatusLabel, type GrantApplicationStatus } from '../../../lib/grants';

interface GrantDocument {
  id: string;
  file_name: string;
  file_url: string;
  doc_type: string | null;
  created_at: string;
}

interface AppRow {
  id: string;
  grant_id: string;
  status: GrantApplicationStatus;
  amount_requested: number | null;
  organization_name: string | null;
  submitted_at: string | null;
  decision_at: string | null;
  award_amount: number | null;
  updated_at: string;
  grants: { id: string; slug: string; title: string; funder_name: string; deadline_at: string | null; currency: string } | null;
  documents?: GrantDocument[];
}

const statusColor: Record<GrantApplicationStatus, 'green' | 'blue' | 'gray' | 'red'> = {
  draft: 'gray',
  submitted: 'blue',
  under_review: 'blue',
  awarded: 'green',
  rejected: 'red',
  withdrawn: 'gray',
};

function money(cents: number | null, currency = 'USD'): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(cents / 100));
}

function docTypeLabel(type: string | null): string {
  if (!type) return 'Document';
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

function Documents({ docs, available }: { docs: GrantDocument[]; available: boolean }) {
  // Nothing to say when an application simply has no attachments — an empty
  // "Attachments (0)" block is noise on every draft.
  if (docs.length === 0) {
    if (available) return null;
    return (
      <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--t3)' }}>
        Attachments could not be loaded — they have not been removed.
      </div>
    );
  }
  return (
    <div style={{ flexBasis: '100%', minWidth: 0, borderTop: '1px solid var(--b1)', paddingTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', marginBottom: 6 }}>
        {docs.length === 1 ? '1 attachment' : `${docs.length} attachments`}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {docs.map((d) => (
          <li key={d.id} style={{ minWidth: 0 }}>
            <a
              href={d.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%',
                fontSize: 12.5, padding: '6px 10px', borderRadius: 999,
                border: '1px solid var(--b1)', background: 'var(--s2)', color: 'var(--t2)',
                textDecoration: 'none',
                // 24px min keeps the chip a valid WCAG 2.2 SC 2.5.8 tap target.
                minHeight: 24,
              }}
            >
              <span aria-hidden="true">📎</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.file_name}
              </span>
              <span style={{ color: 'var(--t3)', flexShrink: 0 }}>· {docTypeLabel(d.doc_type)}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GrantApplicationsClient() {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Attachments failing to load is NOT the same as an application having none —
  // the API says which happened, so the UI can stop short of implying the files
  // are gone.
  const [docsAvailable, setDocsAvailable] = useState(true);

  function load() {
    return fetch('/api/grants/applications')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((json) => { setApps(json.applications ?? []); setDocsAvailable(json.documentsAvailable !== false); setError(null); })
      .catch(() => { setApps([]); setError('Could not load your applications.'); });
  }

  useEffect(() => {
    fetch('/api/grants/applications')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((json) => { setApps(json.applications ?? []); setDocsAvailable(json.documentsAvailable !== false); setError(null); })
      .catch(() => { setApps([]); setError('Could not load your applications.'); });
  }, []);

  async function transition(id: string, status: 'submitted' | 'withdrawn') {
    setBusy(id);
    try {
      const res = await fetch(`/api/grants/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Update failed');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  if (apps === null) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: 'var(--t3)' }}><Spinner /></div>;
  }

  if (apps.length === 0) {
    return (
      <EmptyState
        icon="📄"
        title="No grant applications yet"
        body="Browse open grants and start an application — your drafts will appear here."
        action={<BtnLink href="/grants">Browse grants</BtnLink>}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && <div style={{ fontSize: 13, color: 'var(--red-text)' }}>{error}</div>}
      {apps.map((a) => (
        <div key={a.id} style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', padding: 16,
        }}>
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge color={statusColor[a.status]}>{grantApplicationStatusLabel(a.status)}</Badge>
              {a.grants && <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 700 }}>{a.grants.funder_name}</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginTop: 4 }}>
              {a.grants
                ? <Link href={`/grants/${a.grants.slug}`}>{a.grants.title}</Link>
                : 'Grant unavailable'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
              Requested {money(a.amount_requested, a.grants?.currency)}
              {a.status === 'awarded' && a.award_amount != null && ` · Awarded ${money(a.award_amount, a.grants?.currency)}`}
            </div>
          </div>
          <Documents docs={a.documents ?? []} available={docsAvailable} />
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {a.status === 'draft' && (
              <Btn size="sm" loading={busy === a.id} onClick={() => transition(a.id, 'submitted')}>Submit</Btn>
            )}
            {(a.status === 'draft' || a.status === 'submitted') && (
              <Btn size="sm" variant="ghost" loading={busy === a.id} onClick={() => transition(a.id, 'withdrawn')}>Withdraw</Btn>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
