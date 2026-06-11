'use client';

import React, { useState } from 'react';

export default function ReceiptButton({ donationId }: { donationId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function send() {
    setState('sending');
    try {
      const res = await fetch('/api/donations/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId }),
      });
      if (!res.ok) throw new Error();
      setState('sent');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  if (state === 'sent') {
    return <span style={{ fontSize: 11, color: 'var(--green-dark, #065f46)', fontWeight: 700 }}>✓ Sent</span>;
  }

  return (
    <button
      type="button"
      onClick={() => void send()}
      disabled={state === 'sending'}
      style={{
        fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
        color: state === 'error' ? 'var(--red, #be123c)' : 'var(--t3, #94a3b8)',
        background: 'none', border: 'none', padding: 0, textDecoration: 'underline',
        cursor: state === 'sending' ? 'wait' : 'pointer',
      }}
    >
      {state === 'sending' ? 'Sending…' : state === 'error' ? 'Failed — retry' : 'Email receipt'}
    </button>
  );
}
