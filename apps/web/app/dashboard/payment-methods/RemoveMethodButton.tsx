'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Detaches a saved card at Stripe.
 *
 * Confirms first, deliberately. Removing a payment method is not destructive to
 * money, but it is destructive to a recurring donation someone set up months ago
 * and has not thought about since — so the confirm names the card rather than
 * asking a generic "Are you sure?", which people click through without reading.
 */
export default function RemoveMethodButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (busy) return;
    const ok = window.confirm(
      `Remove ${label}?\n\nFuture donations will need a different card. Any recurring donation using this card will need updating.`,
    );
    if (!ok) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        // Show what actually went wrong where we safely can. The route never
        // returns Stripe's raw message for anything but a known-safe case.
        setError(body.error ?? 'We could not remove that card. Please try again.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('We could not reach the server. Please try again.');
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        style={{
          minHeight: '36px',
          padding: '0 14px',
          borderRadius: 'var(--r)',
          border: '1px solid var(--b2)',
          background: 'transparent',
          color: 'var(--t2)',
          fontSize: '13px',
          fontWeight: 700,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Removing…' : 'Remove'}
      </button>
      {error ? (
        <span role="alert" style={{ fontSize: '12px', color: 'var(--red-text, var(--red))' }}>
          {error}
        </span>
      ) : null}
    </>
  );
}
