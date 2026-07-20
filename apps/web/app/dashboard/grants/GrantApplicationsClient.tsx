'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Btn, Badge, EmptyState, Spinner } from '../../../components/ui';
import { grantApplicationStatusLabel, type GrantApplicationStatus } from '../../../lib/grants';

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

export default function GrantApplicationsClient() {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    return fetch('/api/grants/applications')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((json) => { setApps(json.applications ?? []); setError(null); })
      .catch(() => { setApps([]); setError('Could not load your applications.'); });
  }

  useEffect(() => {
    fetch('/api/grants/applications')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((json) => { setApps(json.applications ?? []); setError(null); })
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
        action={<Link href="/grants"><Btn>Browse grants</Btn></Link>}
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
