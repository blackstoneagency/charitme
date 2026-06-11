'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeApp';

export default function CancelRecurringPage() {
  const params = useSearchParams();
  const router = useRouter();
  const subscriptionId = params.get('sub') ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleCancel() {
    if (!subscriptionId) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/donations/recurring/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to cancel.'); return; }
      setDone(true);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  if (!subscriptionId) {
    return (
      <CharitMeShell active="Recurring">
        <TopBar title="Cancel Recurring Donation" subtitle="" />
        <div style={{ padding: '32px', color: 'var(--t3)' }}>Invalid request. <Link href="/dashboard/recurring" style={{ color: 'var(--green)' }}>Back to recurring donations.</Link></div>
      </CharitMeShell>
    );
  }

  if (done) {
    return (
      <CharitMeShell active="Recurring">
        <TopBar title="Subscription Cancelled" subtitle="" />
        <div className="kf-admin-dash" style={{ maxWidth: 500 }}>
          <div style={{ background: '#f0fff8', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#064e3b' }}>Cancellation confirmed</h2>
            <p style={{ fontSize: 14, color: '#065f46', margin: '0 0 20px', lineHeight: 1.6 }}>
              Your recurring donation has been cancelled. You won&apos;t be charged again. Your final billing period access continues until its end date.
            </p>
            <button onClick={() => router.push('/dashboard/recurring')} style={{ padding: '10px 28px', background: '#19b86a', color: '#fff', border: 0, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Back to Recurring
            </button>
          </div>
        </div>
      </CharitMeShell>
    );
  }

  return (
    <CharitMeShell active="Recurring">
      <TopBar title="Cancel Recurring Donation" subtitle="This action will stop future billing." />
      <div className="kf-admin-dash" style={{ maxWidth: 500 }}>
        <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: 14, padding: '28px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900 }}>Cancel this recurring donation?</h2>
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: '0 0 24px', lineHeight: 1.6 }}>
            You will not be charged again. Your current billing period continues until its end date.
            The campaign organiser will no longer receive your monthly support.
          </p>
          {error && <p style={{ color: '#be123c', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>⚠ {error}</p>}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => void handleCancel()} disabled={loading}
              style={{ padding: '12px 28px', background: loading ? 'var(--b2)' : '#ef4444', color: '#fff', border: 0, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Cancelling…' : 'Yes, cancel subscription'}
            </button>
            <Link href="/dashboard/recurring" style={{ padding: '12px 28px', border: '1px solid var(--b2)', borderRadius: 10, background: '#fff', color: 'var(--t1)', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Keep subscription
            </Link>
          </div>
        </div>
      </div>
    </CharitMeShell>
  );
}
