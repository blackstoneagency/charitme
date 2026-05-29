'use client';

import React, { useState } from 'react';

type ChunkResult = { name: string; ok: boolean; error?: string };

export default function ApplySchemaButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<ChunkResult[]>([]);
  const [message, setMessage] = useState('');

  async function apply() {
    setState('running');
    setResults([]);
    setMessage('');

    try {
      const res = await fetch('/api/admin/apply-schema', { method: 'POST' });
      const data = await res.json() as { ok: boolean; message: string; results: ChunkResult[] };
      setResults(data.results ?? []);
      setMessage(data.message ?? '');
      setState(data.ok ? 'done' : 'error');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <strong style={{ fontSize: 15, color: '#065f46' }}>{message}</strong>
        </div>
        <p style={{ fontSize: 13, color: '#065f46', margin: '0 0 12px' }}>
          All tables created. Refresh the page to see updated checks.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', background: '#19b86a', color: '#fff', border: 0, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Refresh Page →
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void apply()}
        disabled={state === 'running'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '14px 32px', border: 0, borderRadius: 12,
          background: state === 'running' ? '#9f7de8' : 'linear-gradient(135deg,#6c35ff,#4d1ee0)',
          color: '#fff', fontSize: 15, fontWeight: 900,
          cursor: state === 'running' ? 'wait' : 'pointer',
          boxShadow: '0 4px 20px rgba(108,53,255,.35)',
          transition: 'opacity .15s',
        }}
      >
        {state === 'running' ? (
          <>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙</span>
            Applying schema… please wait
          </>
        ) : (
          '🚀 Apply Schema Now — One Click'
        )}
      </button>

      {state === 'running' && (
        <p style={{ fontSize: 13, color: '#7f1d1d', margin: '10px 0 0' }}>
          Creating all {17} table groups, indexes, RLS policies, triggers, and platform settings…
        </p>
      )}

      {state === 'error' && message && (
        <div style={{ marginTop: 14, padding: '14px 18px', background: '#fff0f3', border: '1px solid #fca5a5', borderRadius: 10 }}>
          <p style={{ fontSize: 13, color: '#be123c', fontWeight: 700, margin: '0 0 8px' }}>Error: {message}</p>
          <button type="button" onClick={() => void apply()}
            style={{ padding: '8px 20px', background: '#be123c', color: '#fff', border: 0, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 16, maxHeight: 240, overflowY: 'auto', background: '#1e1e2e', borderRadius: 10, padding: '12px 16px' }}>
          {results.map((r, i) => (
            <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', color: r.ok ? '#4ade80' : '#f87171', marginBottom: 3 }}>
              {r.ok ? '✓' : '✗'} {r.name}{r.error ? ` — ${r.error.slice(0, 80)}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
