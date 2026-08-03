'use client';

import React, { useState } from 'react';
import { formatMoneyShort } from '@shared/currencies';

export interface ClaimRow {
  id: string;
  employee_name: string | null;
  employee_email: string | null;
  donation_amount_cents: number;
  match_amount_cents: number;
  status: 'pending' | 'approved' | 'declined' | 'paid';
  created_at: string;
}

const STATUS_TONE: Record<ClaimRow['status'], { bg: string; fg: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,.1)', fg: '#c2410c', label: 'Pending' },
  approved: { bg: 'rgba(40,120,255,.1)', fg: 'var(--blue)', label: 'Approved' },
  paid:     { bg: 'rgba(18,166,83,.12)', fg: 'var(--green-dark)', label: 'Paid' },
  declined: { bg: 'rgba(255,59,95,.08)', fg: 'var(--red)', label: 'Declined' },
};

// Sponsor-side review of matching-gift claims. Uses the existing
// PATCH /api/matching/claims/:id endpoint (sponsor authz + state machine there).
export default function CorporateClaimsClient({ claims, currency }: { claims: ClaimRow[]; currency: string }) {
  const [rows, setRows] = useState<ClaimRow[]>(claims);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fmt = (c: number) => formatMoneyShort(c, currency);

  const act = async (id: string, status: 'approved' | 'declined' | 'paid') => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/matching/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Could not update the claim.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) {
    return <p style={{ padding: '16px 0', color: 'var(--t3, var(--t3))', fontSize: 14 }}>No match claims yet.</p>;
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600, background: 'rgba(255,59,95,.08)', color: 'var(--red)', border: '1px solid rgba(255,59,95,.28)' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const tone = STATUS_TONE[r.status];
          return (
            <div key={r.id} style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--b1, var(--b1))', borderRadius: 12, background: 'var(--s1, #fff)' }}>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1, var(--t1))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.employee_name || r.employee_email || 'Employee'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3, var(--t3))' }}>
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 92 }}>
                <div style={{ fontSize: 12, color: 'var(--t3, var(--t3))' }}>Donation {fmt(r.donation_amount_cents)}</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--green-text, var(--green-dark))' }}>Match {fmt(r.match_amount_cents)}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.fg }}>
                {tone.label}
              </span>
              <div style={{ display: 'flex', minWidth: 0, gap: 8 }}>
                {r.status === 'pending' && (
                  <>
                    <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'approved')}
                      style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--green-dark)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy === r.id ? 'not-allowed' : 'pointer', opacity: busy === r.id ? 0.6 : 1 }}>
                      Approve
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'declined')}
                      style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid var(--b1, var(--b1))', background: 'var(--s1, #fff)', color: 'var(--t2, var(--t2))', fontWeight: 700, fontSize: 13, cursor: busy === r.id ? 'not-allowed' : 'pointer', opacity: busy === r.id ? 0.6 : 1 }}>
                      Decline
                    </button>
                  </>
                )}
                {r.status === 'approved' && (
                  <button type="button" disabled={busy === r.id} onClick={() => act(r.id, 'paid')}
                    style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--violet)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: busy === r.id ? 'not-allowed' : 'pointer', opacity: busy === r.id ? 0.6 : 1 }}>
                    Mark paid
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
