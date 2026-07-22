'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export default function PauseResumeButton({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: 'active' | 'paused';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const action = status === 'active' ? 'pause' : 'resume';
  const label = status === 'active' ? 'Pause' : 'Resume';

  async function handleClick() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/donations/recurring/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update subscription');
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update subscription');
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        style={{
          fontSize: 12, fontWeight: 700, color: 'var(--t3)', padding: '6px 14px',
          border: '1px solid var(--b2)', borderRadius: 8, background: 'var(--s1)',
          flexShrink: 0, cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? '…' : label}
      </button>
      {error && <span style={{ fontSize: 11, color: 'var(--red, #be123c)' }}>{error}</span>}
    </div>
  );
}
