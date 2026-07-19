'use client';

import React, { useState } from 'react';
import { Btn, Badge } from '../../../../components/ui';
import type { AdminPrivacyRequest } from '../../../../lib/privacy';

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'red' | 'blue'> = {
  pending: 'blue',
  in_progress: 'blue',
  completed: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

export default function AdminPrivacyClient({ initialRequests }: { initialRequests: AdminPrivacyRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, status: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/privacy/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Action failed.');
        return;
      }
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: status as AdminPrivacyRequest['status'] } : r)));
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--t4)' }}>No privacy requests yet.</p>;
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--t3)', borderBottom: '1px solid var(--b2)' }}>
              <th style={{ padding: '8px 10px' }}>User</th>
              <th style={{ padding: '8px 10px' }}>Type</th>
              <th style={{ padding: '8px 10px' }}>Status</th>
              <th style={{ padding: '8px 10px' }}>Requested</th>
              <th style={{ padding: '8px 10px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const open = r.status === 'pending' || r.status === 'in_progress';
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--b3)' }}>
                  <td style={{ padding: '10px' }}>
                    <div style={{ fontWeight: 600 }}>{r.user_name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--t4)' }}>{r.user_email ?? r.user_id.slice(0, 8)}</div>
                  </td>
                  <td style={{ padding: '10px', textTransform: 'capitalize' }}>{r.type}</td>
                  <td style={{ padding: '10px' }}>
                    <Badge color={STATUS_COLOR[r.status] ?? 'gray'}>{r.status.replace('_', ' ')}</Badge>
                  </td>
                  <td style={{ padding: '10px', color: 'var(--t4)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '10px' }}>
                    {open ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {r.status === 'pending' && (
                          <Btn size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => act(r.id, 'in_progress')}>
                            Start
                          </Btn>
                        )}
                        <Btn size="sm" disabled={busyId === r.id} onClick={() => act(r.id, 'completed')}>
                          {r.type === 'deletion' ? 'Complete + anonymize' : 'Complete'}
                        </Btn>
                        <Btn size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => act(r.id, 'rejected')}>
                          Reject
                        </Btn>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--t4)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
