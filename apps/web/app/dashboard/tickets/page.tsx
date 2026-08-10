import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import DegradedReadNotice from '../../../components/DegradedReadNotice';
import { requireUser } from '../../../lib/auth';
import { createClient } from '../../../lib/supabase-server';
import { getAppOrigin } from '../../../lib/auth-config';
import { formatMoneyCompact } from '@shared/currencies';
import TicketActions from './TicketActions';
import { isBeforeEventStart } from '../../../lib/events-core';

export const dynamic = 'force-dynamic';

type TicketRow = {
  id: string;
  quantity: number;
  amount_cents: number;
  currency: string;
  status: string;
  ticket_code: string;
  confirmed_at: string | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    slug: string;
    starts_at: string;
    location: string | null;
  } | null;
  ticket: { title: string } | null;
  checkins: Array<{ checked_in_at: string }> | null;
};

function ticketRows(value: unknown): TicketRow[] {
  return Array.isArray(value) ? value as TicketRow[] : [];
}

function statusLabel(status: string): string {
  if (status === 'refund_pending') return 'Refund pending';
  if (status === 'partially_refunded') return 'Partially refunded';
  return status.replaceAll('_', ' ');
}

export default async function TicketsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_registrations')
    .select(`
      id,quantity,amount_cents,currency,status,ticket_code,confirmed_at,created_at,
      event:event_id(id,title,slug,starts_at,location),
      ticket:ticket_id(title),
      checkins:event_checkins(checked_in_at)
    `)
    .eq('attendee_id', user.id)
    .in('status', ['confirmed', 'refund_pending', 'partially_refunded', 'refunded', 'disputed'])
    .order('created_at', { ascending: false })
    .limit(100);
  const tickets = ticketRows(data);
  const origin = getAppOrigin();

  return (
    <CharitMeShell active="My Tickets">
      <TopBar title="My Tickets" subtitle="Admission, check-in, and refunds for your events." />
      {error && <DegradedReadNotice title="We couldn't load your tickets" />}

      {!error && tickets.length === 0 && (
        <section className="kf-card" style={{ padding: 28, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>No event tickets yet</h2>
          <Link href="/events" className="kf-btn" style={{ display: 'inline-flex', marginTop: 16, textDecoration: 'none' }}>
            Browse events
          </Link>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
        {tickets.map((registration) => {
          const event = registration.event;
          if (!event) return null;
          const active = ['confirmed', 'partially_refunded', 'disputed'].includes(registration.status);
          const startsAt = new Date(event.starts_at);
          const refundable = registration.status === 'confirmed'
            && registration.amount_cents > 0
            && isBeforeEventStart(event.starts_at);
          const checkinUrl = `${origin}/events/check-in?code=${encodeURIComponent(registration.ticket_code)}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(checkinUrl)}`;

          return (
            <article key={registration.id} className="kf-card" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`kf-pill ${registration.status === 'refunded' ? 'orange' : registration.status === 'disputed' ? 'red' : 'green'}`}>
                      {statusLabel(registration.status)}
                    </span>
                    {registration.checkins?.length ? <span className="kf-pill green">Checked in</span> : null}
                  </div>
                  <h2 style={{ margin: '10px 0 4px', fontSize: 20 }}>{event.title}</h2>
                  <p style={{ margin: 0, color: 'var(--t2)', fontSize: 14 }}>
                    {registration.ticket?.title ?? 'General admission'} x {registration.quantity}
                  </p>
                  <p style={{ margin: '6px 0 0', color: 'var(--t3)', fontSize: 13 }}>
                    {startsAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
                    {event.location ? ` | ${event.location}` : ''}
                  </p>
                  <p style={{ margin: '10px 0 0', fontWeight: 700 }}>
                    {formatMoneyCompact(registration.amount_cents, registration.currency)}
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                    <Link href={`/events/${event.slug}`} className="kf-outline" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', textDecoration: 'none' }}>
                      Event details
                    </Link>
                    <TicketActions registrationId={registration.id} refundable={refundable} />
                  </div>
                </div>
                {active && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'center', gap: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} width={156} height={156} alt={`Check-in QR code for ${event.title}`} style={{ border: '1px solid var(--b2)', borderRadius: 8, padding: 6, background: 'var(--s1)' }} />
                    <span style={{ color: 'var(--t3)', fontSize: 11 }}>Present at check-in</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </CharitMeShell>
  );
}
