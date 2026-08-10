import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '../../../components/ui';
import { getUser } from '../../../lib/auth';
import { getEventBySlug, attendeeRegisteredQty, listEventTickets } from '../../../lib/events';
import {
  isRegistrationOpen,
  remainingCapacity,
  isEventFree,
  ticketsRemaining,
  isTicketSoldOut,
} from '../../../lib/events-core';
import RsvpPanel from './RsvpPanel';
import AuctionLots from './_components/AuctionLots';
import { listAuctionItems, countBidsByItem } from '../../../lib/auctions';
import { realUrlOrNull } from '../../../lib/placeholder-url';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e) return { title: 'Event not found' };
  return { title: `${e.title} — Event`, description: e.description?.slice(0, 155) ?? undefined };
}

export const dynamic = 'force-dynamic';

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e || (e.status !== 'published' && e.status !== 'completed')) notFound();

  const user = await getUser();
  const isOrganizer = user?.id === e.created_by;
  const alreadyRegistered = user && !isOrganizer ? (await attendeeRegisteredQty(e.id, user.id)) > 0 : false;

  const remaining = remainingCapacity(e.capacity, e.registered_qty);
  const open = isRegistrationOpen(e, e.registered_qty);

  // `event_tickets` was seeded but read by nothing, so every event displayed as a
  // free RSVP even when it had paid tiers.
  const { tickets, failed: ticketsFailed } = await listEventTickets(e.id);
  const { items: auctionItems, failed: auctionFailed } = await listAuctionItems(e.id);
  const bidCountMap = auctionItems.length > 0 ? await countBidsByItem(auctionItems.map((i) => i.id)) : new Map();
  // A null map means the count read failed. It is passed through as null so each
  // lot says "bid count unavailable" rather than "0 bids", which would tell a
  // bidder the lot is uncontested when we simply could not check.
  const bidCounts = bidCountMap === null ? null : Object.fromEntries(bidCountMap);
  const free = !ticketsFailed && isEventFree(tickets);
  const money = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 780 }}>
      <Link href="/events" style={{ fontSize: 14, color: 'var(--t3)', textDecoration: 'none' }}>← All events</Link>

      <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap', margin: '18px 0 12px' }}>
        <Badge color="blue">{e.event_type.replace('_', ' ')}</Badge>
        {e.virtual_url ? <Badge color="green">Virtual</Badge> : e.location ? <Badge color="gray">{e.location}</Badge> : null}
        {Number.isFinite(remaining) && (remaining > 0 ? <Badge color="green">{remaining} spots left</Badge> : <Badge color="red">Full</Badge>)}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{e.title}</h1>
      <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 4 }}>🗓 {dateLabel(e.starts_at)}</div>
      {e.location && <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 4 }}>📍 {e.location}</div>}
      {/* 120 events in production carry an `example.org` virtual_url — an RFC 2606
          documentation domain that never resolves. Showing it as a "Join link" hands
          attendees a dead link at the moment they try to join. */}
      {realUrlOrNull(e.virtual_url) && open && (
        <div style={{ fontSize: 14, marginBottom: 4 }}>
          🔗 <a href={e.virtual_url as string} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>Join link</a>
        </div>
      )}

      {e.description && (
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--t2)', whiteSpace: 'pre-wrap', marginTop: 18 }}>{e.description}</p>
      )}

      {ticketsFailed && (
        <p role="alert" style={{ marginTop: 24, padding: '12px 14px', borderRadius: 10, background: 'var(--s2)', border: '1px solid var(--b2)', fontSize: 13.5, color: 'var(--t2)' }}>
          Ticket information couldn&apos;t be loaded just now — this event may have paid
          tickets. Please reload before assuming entry is free.
        </p>
      )}

      {(auctionItems.length > 0 || auctionFailed) && (
        <section style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--b2)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Auction lots</h2>
          {auctionFailed ? (
            <p role="alert" style={{ fontSize: 13.5, color: 'var(--t2)', margin: 0 }}>
              We couldn&rsquo;t load the auction lots for this event. This is not the same as
              there being none — please reload before assuming nothing is up for bid.
            </p>
          ) : (
            <AuctionLots items={auctionItems} bidCounts={bidCounts} signedIn={Boolean(user)} />
          )}
        </section>
      )}

      {tickets.length > 0 && (
        <section style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--b2)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Tickets</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            {tickets.map((t) => {
              const left = ticketsRemaining(t);
              const soldOut = isTicketSoldOut(t);
              return (
                <li
                  key={t.id}
                  style={{
                    display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, flexWrap: 'wrap',
                    padding: '12px 14px', border: '1px solid var(--b2)', borderRadius: 10,
                    background: 'var(--s1)', opacity: soldOut ? 0.6 : 1,
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 15, color: 'var(--t1)' }}>{t.title}</strong>
                    {left !== null && (
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--t3)', marginTop: 2 }}>
                        {soldOut ? 'Sold out' : `${left} left`}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--t1)' }}>
                    {t.price_cents > 0 ? money(t.price_cents) : 'Free'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--b2)' }}>
        <RsvpPanel
          eventId={e.id}
          signedIn={!!user}
          isOrganizer={isOrganizer}
          open={open}
          alreadyRegistered={alreadyRegistered}
          slug={e.slug}
          free={free}
          tickets={tickets}
        />
      </div>
    </div>
  );
}
