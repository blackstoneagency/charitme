'use client';

import { useState } from 'react';
import { Btn, Badge, Card } from '../../../components/ui';
import { privacyRequestStatusLabel, privacyRequestTypeLabel, type PrivacyRequestStatus, type PrivacyRequestType } from '../../../lib/privacy';

export type PrivacyRequestView = {
  id: string;
  requestType: string;
  status: string;
  details: string | null;
  resolutionNote: string | null;
  requestedAt: string;
};

function statusColor(status: string): 'green' | 'red' | 'blue' | 'gray' {
  if (status === 'completed') return 'green';
  if (status === 'rejected' || status === 'cancelled') return 'red';
  if (status === 'processing') return 'blue';
  return 'gray';
}

export default function PrivacyClient({ initialRequests }: { initialRequests: PrivacyRequestView[] }) {
  const [requests, setRequests] = useState<PrivacyRequestView[]>(initialRequests);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasOpen = (type: PrivacyRequestType) =>
    requests.some((r) => r.requestType === type && ['pending', 'processing'].includes(r.status));

  async function fileRequest(requestType: PrivacyRequestType) {
    setBusy(requestType);
    setError(null);
    try {
      const res = await fetch('/api/privacy/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not file request'); return; }
      const r = data.request;
      setRequests((prev) => [
        { id: r.id, requestType: r.request_type, status: r.status, details: r.details ?? null, resolutionNote: null, requestedAt: r.requested_at },
        ...prev,
      ]);
      setConfirmDelete(false);
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/privacy/requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>📦 Export my data</h2>
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>
            Get a copy of your profile, campaigns, donations, and activity. We&apos;ll prepare it and notify you when it&apos;s ready.
          </p>
          <div>
            <Btn onClick={() => fileRequest('export')} loading={busy === 'export'} disabled={hasOpen('export') || busy === 'export'}>
              {hasOpen('export') ? 'Export requested' : 'Request data export'}
            </Btn>
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>🗑️ Delete my account</h2>
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>
            Request permanent deletion of your account and personal data. Active campaigns and financial records required by law are handled per our policy.
          </p>
          <div>
            {hasOpen('deletion') ? (
              <Btn disabled>Deletion requested</Btn>
            ) : confirmDelete ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="danger" onClick={() => fileRequest('deletion')} loading={busy === 'deletion'}>Confirm deletion request</Btn>
                <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
              </div>
            ) : (
              <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Request account deletion</Btn>
            )}
          </div>
        </Card>
      </div>

      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Your requests</h2>
        {requests.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>You haven&apos;t made any privacy requests yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map((r) => {
              const canCancel = ['pending', 'processing'].includes(r.status);
              return (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{privacyRequestTypeLabel(r.requestType as PrivacyRequestType)}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                      Requested {new Date(r.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {r.resolutionNote ? ` · ${r.resolutionNote}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge color={statusColor(r.status)}>{privacyRequestStatusLabel(r.status as PrivacyRequestStatus)}</Badge>
                    {canCancel && <Btn variant="ghost" onClick={() => cancel(r.id)} disabled={busy === r.id}>Cancel</Btn>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
