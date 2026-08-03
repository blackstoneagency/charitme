'use client';

import { useState } from 'react';

/**
 * Buys a membership tier.
 *
 * Replaces the "memberships open soon" note that stood here while
 * `/api/creators/tiers/subscribe` did not exist. That note was the honest thing
 * to show — a Join button that posted nowhere would have been the dead-control
 * defect this repo has spent a lot of effort removing — so this component only
 * exists now that the route behind it does.
 */
export default function JoinTierButton({
  tierId,
  label,
  disabled,
}: {
  tierId: string;
  label: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/creators/tiers/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok && body.url) {
        window.location.href = body.url as string;
        return;
      }
      // 401 is the one case with a real next step, so it gets one rather than an
      // error the visitor cannot act on.
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setError(typeof body.error === 'string' ? body.error : 'Could not start checkout. Please try again.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={join}
        disabled={busy || disabled}
        className="cta-primary"
        style={{ width: '100%', justifyContent: 'center', opacity: busy || disabled ? 0.6 : 1 }}
      >
        {busy ? 'Starting checkout…' : label}
      </button>
      {error && (
        <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--red-text)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
