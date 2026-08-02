'use client';

import { useState } from 'react';

/**
 * Sends the visitor to the Stripe Billing Portal to add a card.
 *
 * Deliberately NOT a card form on this page. Capturing a PAN on our own domain
 * moves CharitMe from PCI SAQ A to SAQ A-EP, in exchange for a worse version of
 * a flow Stripe already localises, 3DS-challenges, and certifies. The portal is
 * the correct implementation, not the lazy one.
 */
export default function AddMethodButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function open() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? 'We could not open the payment portal. Please try again.');
        setBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError('We could not reach the server. Please try again.');
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="cta-primary" onClick={open} disabled={busy} style={{ display: 'inline-flex', border: 0, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? 'Opening…' : '+ Add New Method'}
      </button>
      {error ? (
        <span role="alert" style={{ fontSize: '12px', color: 'var(--red-text, var(--red))' }}>
          {error}
        </span>
      ) : null}
    </>
  );
}
