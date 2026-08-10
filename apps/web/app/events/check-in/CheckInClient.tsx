'use client';

import { useState } from 'react';

type CheckInResult = {
  event_title: string;
  attendee_name: string;
  quantity: number;
};

export default function CheckInClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);

  async function checkIn() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/events/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json: unknown = await response.json().catch(() => ({}));
      const detail = json && typeof json === 'object' ? json as Record<string, unknown> : {};
      if (!response.ok) {
        setError(typeof detail.error === 'string' ? detail.error : 'Check-in failed.');
        return;
      }
      if (
        typeof detail.event_title !== 'string'
        || typeof detail.attendee_name !== 'string'
        || typeof detail.quantity !== 'number'
      ) {
        setError('Check-in succeeded, but the confirmation could not be displayed.');
        return;
      }
      setResult({
        event_title: detail.event_title,
        attendee_name: detail.attendee_name,
        quantity: detail.quantity,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700 }}>
        Ticket code
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          style={{ minHeight: 44, width: '100%', border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: '0 12px', background: 'var(--s1)', color: 'var(--t1)' }}
        />
      </label>
      <button type="button" className="kf-btn" disabled={busy || code.trim().length === 0} onClick={checkIn} style={{ minHeight: 44 }}>
        {busy ? 'Checking...' : 'Check in attendee'}
      </button>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--red-text)', fontSize: 13 }}>{error}</p>}
      {result && (
        <div role="status" style={{ padding: 14, border: '1px solid var(--green)', borderRadius: 'var(--r)', background: 'var(--green-light)' }}>
          <strong>{result.attendee_name} checked in</strong>
          <div style={{ marginTop: 4, color: 'var(--t2)', fontSize: 13 }}>
            {result.event_title} | {result.quantity} {result.quantity === 1 ? 'guest' : 'guests'}
          </div>
        </div>
      )}
    </div>
  );
}
