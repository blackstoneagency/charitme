'use client';

import React, { useState } from 'react';

type ChunkResult = { name: string; ok: boolean; error?: string };
type ApplyResponse = {
  ok: boolean;
  message: string;
  needsToken?: boolean;
  instructions?: string[];
  results?: ChunkResult[];
};

export default function ApplySchemaButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'needs-token' | 'error'>('idle');
  const [results, setResults] = useState<ChunkResult[]>([]);
  const [message, setMessage] = useState('');
  const [instructions, setInstructions] = useState<string[]>([]);

  async function apply() {
    setState('running');
    setResults([]);
    setMessage('');
    setInstructions([]);

    try {
      const res = await fetch('/api/admin/apply-schema', { method: 'POST' });
      const data = await res.json() as ApplyResponse;

      if (data.needsToken) {
        setInstructions(data.instructions ?? []);
        setMessage(data.message ?? '');
        setState('needs-token');
        return;
      }

      setResults(data.results ?? []);
      setMessage(data.message ?? '');
      if (data.ok) {
        setState('done');
        // Auto-refresh after 1.5 s so the DB checks update immediately
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setState('error');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Network error');
      setState('error');
    }
  }

  if (state === 'needs-token') {
    return (
      <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '18px 20px' }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#92400e', margin: '0 0 10px' }}>
          🔑 One more step: Add <code>SUPABASE_ACCESS_TOKEN</code> to Vercel
        </h4>
        <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 14px', lineHeight: 1.6 }}>
          The Supabase Management API requires a personal access token (different from the service role key).
          This is a one-time setup.
        </p>
        <ol style={{ paddingLeft: 20, margin: '0 0 16px', fontSize: 13, color: '#78350f', lineHeight: 1.9 }}>
          {instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="https://supabase.com/dashboard/account/tokens"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: '10px 20px', background: '#1a8917', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
          >
            1. Get Supabase Token ↗
          </a>
          <a
            href="https://vercel.com/blackstoneagency/money-raise/settings/environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: '10px 20px', background: '#000', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
          >
            2. Add to Vercel Env Vars ↗
          </a>
          <button
            type="button"
            onClick={() => { setState('idle'); }}
            style={{ padding: '10px 20px', border: '1px solid #d97706', borderRadius: 10, background: '#fff', color: '#92400e', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            3. Done — Try Again
          </button>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <strong style={{ fontSize: 15, color: '#065f46' }}>{message}</strong>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', background: '#19b86a', color: '#fff', border: 0, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Refresh to verify →
        </button>
        {results.length > 0 && (
          <div style={{ marginTop: 14, maxHeight: 200, overflowY: 'auto', background: '#1e1e2e', borderRadius: 10, padding: '12px 16px' }}>
            {results.map((r, i) => (
              <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: r.ok ? '#4ade80' : '#fbbf24', marginBottom: 2 }}>
                {r.ok ? '✓' : '⚠'} {r.name}
              </div>
            ))}
          </div>
        )}
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
          color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: state === 'running' ? 'wait' : 'pointer',
          boxShadow: '0 4px 20px rgba(108,53,255,.35)',
        }}
      >
        {state === 'running' ? '⚙ Applying schema… please wait' : '🚀 Apply Schema Now — One Click'}
      </button>

      {state === 'running' && (
        <p style={{ fontSize: 13, color: '#7f1d1d', margin: '10px 0 0' }}>
          Creating 29 tables, enabling RLS, setting policies and triggers…
        </p>
      )}

      {state === 'error' && (
        <div style={{ marginTop: 14, padding: '14px 18px', background: '#fff0f3', border: '1px solid #fca5a5', borderRadius: 10 }}>
          <p style={{ fontSize: 13, color: '#be123c', fontWeight: 700, margin: '0 0 8px' }}>Error: {message}</p>
          {results.length > 0 && (
            <div style={{ maxHeight: 180, overflowY: 'auto', background: '#1e1e2e', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
              {results.map((r, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: r.ok ? '#4ade80' : '#f87171', marginBottom: 2 }}>
                  {r.ok ? '✓' : '✗'} {r.name}{r.error ? ` — ${r.error.slice(0, 100)}` : ''}
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setState('idle')}
            style={{ padding: '8px 20px', background: '#be123c', color: '#fff', border: 0, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
