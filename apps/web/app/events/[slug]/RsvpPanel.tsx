'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Btn } from '../../../components/ui';

const linkButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 600,
  fontSize: 14,
  minHeight: 44,
  padding: '10px 20px',
  borderRadius: 'var(--r)',
  background: 'var(--green-btn)',
  color: '#fff',
  textDecoration: 'none',
};

type TicketOption = {
  id: string;
  title: string;
  price_cents: number;
  quantity_limit: number | null;
  sold_count: number;
};

type Props = {
  eventId: string;
  signedIn: boolean;
  isOrganizer: boolean;
  open: boolean;
  alreadyRegistered: boolean;
  slug: string;
  free: boolean;
  tickets: TicketOption[];
};

function available(ticket: TicketOption): number {
  if (ticket.quantity_limit === null) return 20;
  return Math.max(0, Math.min(20, ticket.quantity_limit - ticket.sold_count));
}

export default function RsvpPanel({
  eventId,
  signedIn,
  isOrganizer,
  open,
  alreadyRegistered,
  slug,
  free,
  tickets,
}: Props) {
  const router = useRouter();
  const paidTickets = tickets.filter((ticket) => ticket.price_cents > 0);
  const firstAvailableTicket = paidTickets.find((ticket) => available(ticket) > 0);
  const [registered, setRegistered] = useState(alreadyRegistered);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState(firstAvailableTicket?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const requestKey = useRef<string | null>(null);

  if (isOrganizer) {
    return (
      <div style={{ fontSize: 14, color: 'var(--t3)' }}>
        This is your event.{' '}
        <Link href="/events/manage" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>
          Manage attendees
        </Link>
      </div>
    );
  }

  if (registered) {
    return (
      <p style={{ fontSize: 15, color: 'var(--green-dark)', fontWeight: 600 }}>
        You&apos;re registered.{' '}
        <Link href="/dashboard/tickets" style={{ color: 'inherit' }}>Open your ticket</Link>
      </p>
    );
  }

  if (!signedIn) {
    return (
      <Link href={`/login?next=/events/${slug}`} style={linkButtonStyle}>
        {free ? 'Sign in to RSVP' : 'Sign in to buy tickets'}
      </Link>
    );
  }

  if (!open) {
    return <p style={{ fontSize: 14, color: 'var(--t3)' }}>Registration is closed for this event.</p>;
  }

  async function rsvp() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      });
      const json: unknown = await response.json().catch(() => ({}));
      const detail = json && typeof json === 'object' ? json as Record<string, unknown> : {};
      if (!response.ok) {
        setError(typeof detail.error === 'string' ? detail.error : 'Could not register.');
        return;
      }
      setRegistered(true);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function checkout() {
    if (!ticketId) return;
    setSubmitting(true);
    setError(null);
    requestKey.current ??= window.crypto.randomUUID();
    try {
      const response = await fetch(`/api/events/${eventId}/tickets/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          quantity,
          request_key: requestKey.current,
        }),
      });
      const json: unknown = await response.json().catch(() => ({}));
      const detail = json && typeof json === 'object' ? json as Record<string, unknown> : {};
      if (!response.ok || typeof detail.url !== 'string') {
        setError(typeof detail.error === 'string' ? detail.error : 'Could not start ticket checkout.');
        return;
      }
      window.location.assign(detail.url);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!free) {
    const selected = paidTickets.find((ticket) => ticket.id === ticketId);
    const remaining = selected ? available(selected) : 0;
    return (
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Buy tickets</h2>
        {error && <p role="alert" style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        {firstAvailableTicket ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, maxWidth: 440 }}>
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700 }}>
              Ticket
              <select
                value={ticketId}
                onChange={(event) => {
                  setTicketId(event.target.value);
                  setQuantity(1);
                  requestKey.current = null;
                }}
                style={{ minHeight: 44, border: '1px solid var(--b2)', borderRadius: 'var(--r)', background: 'var(--s1)', color: 'var(--t1)', padding: '0 12px' }}
              >
                {paidTickets.map((ticket) => (
                  <option key={ticket.id} value={ticket.id} disabled={available(ticket) === 0}>
                    {ticket.title} - {(ticket.price_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    {available(ticket) === 0 ? ' (sold out)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13, fontWeight: 700 }}>
              Quantity
              <select
                value={quantity}
                onChange={(event) => {
                  setQuantity(Number(event.target.value));
                  requestKey.current = null;
                }}
                style={{ width: 112, minHeight: 44, border: '1px solid var(--b2)', borderRadius: 'var(--r)', background: 'var(--s1)', color: 'var(--t1)', padding: '0 12px' }}
              >
                {Array.from({ length: remaining }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <div>
              <Btn disabled={submitting || !ticketId || remaining === 0} onClick={checkout}>
                {submitting ? 'Opening checkout...' : 'Continue to secure checkout'}
              </Btn>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>Tickets are sold out.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Reserve your spot</h2>
      {error && <p role="alert" style={{ color: 'var(--red-text)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      <Btn disabled={submitting} onClick={rsvp}>
        {submitting ? 'Registering...' : "RSVP - it's free"}
      </Btn>
    </div>
  );
}
