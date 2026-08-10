'use client';

import React, { useMemo, useState } from 'react';
import {
  ARCHIVE_DEMO_CONFIRMATION,
  LABEL_DEMO_CONFIRMATION,
} from '../../../../lib/demo-data-core';
import type { DemoDataSnapshot } from '../../../../lib/demo-data-admin';

const button: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 7,
  border: '1px solid var(--b2)',
  background: 'var(--s1)',
  color: 'var(--t1)',
  fontWeight: 700,
  cursor: 'pointer',
};

export default function DemoDataClient({ snapshot }: { snapshot: DemoDataSnapshot }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<'label' | 'archive'>('label');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requiredConfirmation = action === 'label' ? LABEL_DEMO_CONFIRMATION : ARCHIVE_DEMO_CONFIRMATION;
  const candidates = useMemo(
    () => snapshot.campaigns.filter((row) => action === 'label' ? !row.is_demo : row.is_demo && !row.deleted_at),
    [action, snapshot.campaigns],
  );

  function changeAction(next: 'label' | 'archive'): void {
    setAction(next);
    setSelected([]);
    setConfirmation('');
    setMessage(null);
  }

  function toggle(id: string): void {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id].slice(0, 100));
  }

  async function submit(): Promise<void> {
    if (selected.length === 0 || confirmation !== requiredConfirmation) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch('/api/admin/super/demo-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, campaignIds: selected, confirmation }),
    });
    const body = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string; updated?: number };
    if (!response.ok) {
      setMessage(body.error ?? 'Request failed');
      setBusy(false);
      return;
    }
    setMessage(`${body.updated ?? selected.length} campaigns updated. Refreshing...`);
    window.location.reload();
  }

  return (
    <div style={{ padding: '0 4px 48px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
      <section aria-label="Demo record totals" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {Object.entries(snapshot.counts).map(([label, value]) => (
          <div className="kf-card" key={label} style={{ padding: 16 }}>
            <strong style={{ display: 'block', fontSize: 24 }}>{value.toLocaleString()}</strong>
            <span style={{ color: 'var(--t3)', textTransform: 'capitalize' }}>Demo {label}</span>
          </div>
        ))}
      </section>

      <section className="kf-card" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>Approved cleanup</h2>
        <p style={{ color: 'var(--t3)', margin: '0 0 16px', maxWidth: 820 }}>
          Labeling accepts only known seed slug patterns. Archiving is reversible, disables donations, and is blocked when any selected campaign has a Stripe payment.
        </p>
        <div role="group" aria-label="Cleanup action" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button type="button" aria-pressed={action === 'label'} onClick={() => changeAction('label')} style={{ ...button, background: action === 'label' ? 'var(--green-btn)' : 'var(--s1)', color: action === 'label' ? '#fff' : 'var(--t1)' }}>Label seed candidates</button>
          <button type="button" aria-pressed={action === 'archive'} onClick={() => changeAction('archive')} style={{ ...button, background: action === 'archive' ? 'var(--red-btn)' : 'var(--s1)', color: action === 'archive' ? '#fff' : 'var(--t1)' }}>Archive labeled demos</button>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--b2)', borderRadius: 7 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead><tr style={{ textAlign: 'left', background: 'var(--s2)' }}><th style={{ padding: 12 }}>Select</th><th style={{ padding: 12 }}>Campaign</th><th style={{ padding: 12 }}>Slug</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>State</th></tr></thead>
            <tbody>
              {candidates.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--b2)' }}>
                  <td style={{ padding: 12 }}><input type="checkbox" aria-label={`Select ${row.title}`} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} style={{ width: 20, height: 20 }} /></td>
                  <td style={{ padding: 12, fontWeight: 700 }}>{row.title}</td>
                  <td style={{ padding: 12 }}><code>{row.slug}</code></td>
                  <td style={{ padding: 12 }}>{row.status}</td>
                  <td style={{ padding: 12 }}>{row.deleted_at ? 'Archived' : row.is_demo ? 'Labeled demo' : 'Seed candidate'}</td>
                </tr>
              ))}
              {candidates.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>No campaigns are eligible for this action.</td></tr>}
            </tbody>
          </table>
        </div>
        {snapshot.truncated && <p role="alert" style={{ color: 'var(--red)' }}>Review is limited to the newest 2,000 matching records. Narrow cleanup batches before proceeding.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, maxWidth: 620, marginTop: 16 }}>
          <label htmlFor="demo-confirmation" style={{ fontWeight: 700 }}>Type <code>{requiredConfirmation}</code> to confirm {selected.length} selected campaigns</label>
          <input id="demo-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" style={{ minHeight: 44, padding: '10px 12px', borderRadius: 7, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 16 }} />
          <button type="button" disabled={busy || selected.length === 0 || confirmation !== requiredConfirmation} onClick={submit} style={{ ...button, justifySelf: 'start', opacity: busy || selected.length === 0 || confirmation !== requiredConfirmation ? 0.55 : 1 }}>
            {busy ? 'Applying...' : action === 'label' ? 'Label selected campaigns' : 'Archive selected campaigns'}
          </button>
          {message && <p role="status" style={{ margin: 0, color: 'var(--t2)' }}>{message}</p>}
        </div>
      </section>
    </div>
  );
}
