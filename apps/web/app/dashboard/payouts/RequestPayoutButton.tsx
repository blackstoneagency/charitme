'use client';

import React, { useState } from 'react';

interface Campaign { id: string; title: string; raised_amount: number; currency?: string | null }

interface Props { campaigns: Campaign[] }

// CharitMe uses Stripe Connect destination charges: donation funds land in the
// organizer's own connected account and Stripe pays them out automatically. There
// is no platform-side "request a payout" step — this opens the organizer's Stripe
// Express dashboard where they manage their balance, schedule, and instant payouts.
export default function ManagePayoutsButton({ campaigns }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const openDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payouts', { method: 'POST' });
      const d = await res.json();
      if (res.ok && d.url) {
        window.open(d.url as string, '_blank', 'noopener,noreferrer');
        setOpen(false);
      } else {
        setError(d.error ?? 'Could not open your Stripe dashboard.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (campaigns.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'var(--violet)', color: '#fff', border: 'none',
          borderRadius: 10, padding: '10px 20px', fontWeight: 650,
          fontSize: 14, cursor: 'pointer',
        }}
      >
        Manage Payouts
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{
            background: 'var(--s1, #fff)', borderRadius: 20, padding: 32,
            width: '100%', maxWidth: 460,
            boxShadow: '0 24px 60px rgba(0,0,0,.2)',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: 'var(--t1, var(--t1))' }}>
              Payouts are automatic
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'var(--t2, var(--t2))' }}>
              Donations go straight to your connected Stripe account and are paid out
              to your bank automatically on your payout schedule — CharitMe never holds
              your funds. Open your Stripe dashboard to see your balance, change your
              payout schedule, view history, or start an instant payout.
            </p>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600,
                background: 'rgba(255,59,95,.08)', color: 'var(--red)', border: '1px solid rgba(255,59,95,.28)',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid var(--b1, var(--b1))', background: 'var(--s1, #fff)', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'var(--t3, var(--t3))' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={openDashboard}
                disabled={loading}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--violet)', color: '#fff', fontWeight: 650, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Opening…' : 'Open Stripe Dashboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
