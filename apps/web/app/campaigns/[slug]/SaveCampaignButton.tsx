'use client';

import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export default function SaveCampaignButton({
  campaignId,
  initialSaved,
  isAuthenticated,
  loginNext,
}: {
  campaignId: string;
  initialSaved: boolean;
  isAuthenticated: boolean;
  loginNext: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    setLoading(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      const res = await fetch('/api/saved-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { saved: boolean };
      setSaved(data.saved);
    } catch {
      setSaved(!next); // revert on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved campaigns' : 'Save campaign'}
      title={saved ? 'Saved — click to remove' : 'Save for later'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
        borderRadius: 999, border: `1.5px solid ${saved ? 'var(--violet)' : 'var(--b2)'}`,
        background: saved ? 'var(--s2, #f0eaff)' : 'var(--s1, #fff)',
        color: saved ? 'var(--violet)' : 'var(--t2)',
        fontSize: 13, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
        transition: 'border-color .15s, background .15s, color .15s',
        flexShrink: 0,
      }}
    >
      <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
