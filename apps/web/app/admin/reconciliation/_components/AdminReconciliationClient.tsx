'use client';

import React, { useState } from 'react';
import { Btn, Badge } from '../../../../components/ui';
import type { ExceptionRow } from '../../../../lib/reconciliation';

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'red' | 'blue'> = {
  open: 'red',
  assigned: 'blue',
  resolved: 'green',
  ignored: 'gray',
};

const KIND_LABEL: Record<string, string> = {
  missing_ledger: 'Missing ledger',
  duplicate: 'Duplicate posting',
  unbalanced_group: 'Unbalanced group',
  amount_mismatch: 'Amount mismatch',
  fee_mismatch: 'Fee mismatch',
  missing_stripe: 'Missing in Stripe',
  payout_mismatch: 'Payout mismatch',
  other: 'Other',
};

function money(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Filter = 'open' | 'assigned' | 'resolved' | 'ignored' | 'all';

export default function AdminReconciliationClient({ initialExceptions }: { initialExceptions: ExceptionRow[] }) {
  const [rows, setRows] = useState(initialExceptions);
  const [filter, setFilter] = useState<Filter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(next: Filter) {
    setFilter(next);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reconciliation?status=${next}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Failed to load.');
        return;
      }
      setRows(json.exceptions ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function act(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reconciliation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Action failed.');
        return;
      }
      // Drop the row when it leaves the current filter, else update in place.
      setRows((prev) =>
        filter === 'all' || status === filter
          ? prev.map((r) => (r.id === id ? { ...r, status: status as ExceptionRow['status'] } : r))
          : prev.filter((r) => r.id !== id),
      );
    } finally {
      setBusyId(null);
    }
  }

  const filters: Filter[] = ['open', 'assigned', 'resolved', 'ignored', 'all'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <Btn key={f} size="sm" variant={filter === f ? 'primary' : 'secondary'} onClick={() => load(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </Btn>
        ))}
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--t4)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--t4)' }}>
          {filter === 'open' ? 'No open exceptions — the books balance. 🎉' : 'Nothing here.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--t3)', borderBottom: '1px solid var(--b2)' }}>
                <th style={{ padding: '8px 10px' }}>Kind</th>
                <th style={{ padding: '8px 10px' }}>Detail</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Expected</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actual</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Diff</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px' }}>Raised</th>
                <th style={{ padding: '8px 10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const openish = r.status === 'open' || r.status === 'assigned';
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--b3)' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td style={{ padding: '10px', color: 'var(--t3)', maxWidth: 320 }}>
                      {r.description}
                      {r.donation_id && (
                        <div style={{ fontSize: 12, color: 'var(--t4)', fontFamily: 'var(--mono)' }}>
                          donation {r.donation_id.slice(0, 8)}
                          {r.stripe_ref ? ` · ${r.stripe_ref}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{money(r.expected_cents)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{money(r.actual_cents)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--mono)', color: r.difference_cents ? 'var(--red)' : 'var(--t4)' }}>
                      {money(r.difference_cents)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <Badge color={STATUS_COLOR[r.status] ?? 'gray'}>{r.status}</Badge>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--t4)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px' }}>
                      {openish ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {r.status === 'open' && (
                            <Btn size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => act(r.id, 'assigned')}>
                              Claim
                            </Btn>
                          )}
                          <Btn size="sm" disabled={busyId === r.id} onClick={() => act(r.id, 'resolved')}>
                            Resolve
                          </Btn>
                          <Btn size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => act(r.id, 'ignored')}>
                            Ignore
                          </Btn>
                        </div>
                      ) : (
                        <Btn size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => act(r.id, 'open')}>
                          Re-open
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
