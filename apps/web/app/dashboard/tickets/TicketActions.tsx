'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TicketActions({
  registrationId,
  refundable,
}: {
  registrationId: string;
  refundable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestRefund() {
    if (!window.confirm('Refund this ticket purchase? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/registrations/${registrationId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json: unknown = await response.json().catch(() => ({}));
      const detail = json && typeof json === 'object' ? json as Record<string, unknown> : {};
      if (!response.ok) {
        setError(typeof detail.error === 'string' ? detail.error : 'The refund could not be started.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6 }}>
      {refundable && (
        <button
          type="button"
          onClick={requestRefund}
          disabled={busy}
          className="kf-outline"
          style={{ minHeight: 44 }}
        >
          {busy ? 'Starting refund...' : 'Refund ticket'}
        </button>
      )}
      {error && <p role="alert" style={{ margin: 0, color: 'var(--red-text)', fontSize: 12 }}>{error}</p>}
    </div>
  );
}
