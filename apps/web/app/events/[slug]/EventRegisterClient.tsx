'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { currencySymbol } from '@shared/currencies';
import { Btn, Badge, Card } from '../../../components/ui';
import { isTicketAvailable } from '../../../lib/events';

export type TicketOption = {
  id: string;
  title: string;
  priceCents: number;
  quantityLimit: number | null;
  soldCount: number;
};

export default function EventRegisterClient({ slug, tickets }: { slug: string; tickets: TicketOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const freeTickets = tickets.filter((t) => t.priceCents === 0);
  const paidTickets = tickets.filter((t) => t.priceCents > 0);
  // If there are no ticket tiers at all, a plain RSVP is allowed.
  const canRsvp = tickets.length === 0 || freeTickets.length > 0;

  async function register(ticketId?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${slug}/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketId ? { ticketId } : {}),
      });
      if (res.status === 401) { router.push(`/login?next=/events/${slug}`); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not register'); return; }
      setRegistered(true);
    } finally {
      setBusy(false);
    }
  }

  function fmt(cents: number) {
    return `${currencySymbol('usd')}${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  if (registered) {
    return (
      <Card>
        <Badge color="green">You&apos;re registered ✓</Badge>
        <p style={{ fontSize: 14, color: 'var(--t3)', marginTop: 8 }}>We&apos;ve saved your spot. Check your notifications for event details.</p>
      </Card>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Register</h2>

      {tickets.length === 0 && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 10 }}>This is a free event — reserve your spot.</p>
          <Btn onClick={() => register()} loading={busy} disabled={busy}>Register to attend</Btn>
        </div>
      )}

      {freeTickets.map((t) => {
        const available = isTicketAvailable(t.quantityLimit, t.soldCount);
        return (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>Free{t.quantityLimit != null ? ` · ${Math.max(0, t.quantityLimit - t.soldCount)} left` : ''}</div>
            </div>
            {available ? (
              <Btn onClick={() => register(t.id)} loading={busy} disabled={busy}>Register</Btn>
            ) : (
              <Badge color="red">Sold out</Badge>
            )}
          </div>
        );
      })}

      {paidTickets.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Paid tickets</h3>
          {paidTickets.map((t) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 10, marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{fmt(t.priceCents)}</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>Checkout coming soon</span>
            </div>
          ))}
        </div>
      )}

      {!canRsvp && paidTickets.length > 0 && (
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>Paid ticket checkout is being finalized — free registration isn&apos;t available for this event.</p>
      )}

      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}
    </Card>
  );
}
