'use client';

import React, { useState } from 'react';

type Result = {
  ok: boolean;
  message: string;
  profiles: unknown;
  campaigns: unknown;
  donations: unknown;
};

export default function ReloadCacheButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<Result | null>(null);

  async function reload() {
    setState('loading');
    try {
      const res = await fetch('/api/health', { method: 'POST' });
      const data = await res.json() as Result;
      setResult(data);
      setState(data.ok ? 'done' : 'error');
      if (data.ok) {
        // Auto-refresh page so the checks update
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Network error', profiles: null, campaigns: null, donations: null });
      setState('error');
    }
  }

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 24px', border: 0, borderRadius: 10,
    background: state === 'loading' ? '#64748b' : '#1a1a2e',
    color: '#fff', fontSize: 14, fontWeight: 800,
    cursor: state === 'loading' ? 'wait' : 'pointer',
    transition: 'opacity .15s',
  };

  return (
    <div>
      <button type="button" onClick={() => void reload()} disabled={state === 'loading'} style={btnStyle}>
        {state === 'loading' ? '⏳ Reloading…' : '🔄 Reload PostgREST Cache'}
      </button>

      {state === 'done' && result && (
        <div style={{ marginTop: 10, padding: '12px 16px', background: '#f0fff8', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#065f46' }}>
          ✅ {result.message}
          <br />profiles: {String(result.profiles)} · campaigns: {String(result.campaigns)} · donations: {String(result.donations)}
        </div>
      )}

      {state === 'error' && result && (
        <div style={{ marginTop: 10, padding: '12px 16px', background: '#fff0f3', border: '1px solid #fca5a5', borderRadius: 10, fontSize: 13, color: '#be123c' }}>
          ⚠ {result.message}
          <br />
          <button type="button" onClick={() => { setState('idle'); setResult(null); }}
            style={{ marginTop: 6, padding: '4px 14px', background: '#be123c', color: '#fff', border: 0, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
