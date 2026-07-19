import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { Badge } from '../../../components/ui';
import { eventTypeLabel, isPast } from '../../../lib/events';
import EventRegisterClient, { type TicketOption } from './EventRegisterClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabaseAdmin.from('fundraising_events').select('title').eq('slug', slug).eq('status', 'published').maybeSingle();
  return { title: data?.title ? `${data.title} — Event` : 'Event' };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: event } = await supabaseAdmin
    .from('fundraising_events')
    .select('id, title, slug, event_type, starts_at, ends_at, location, virtual_url, status, campaign_id')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!event) notFound();

  const [{ data: tickets }, { count: registrationCount }, { data: campaign }] = await Promise.all([
    supabaseAdmin.from('event_tickets').select('id, title, price_cents, quantity_limit, sold_count').eq('event_id', event.id),
    supabaseAdmin.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', event.id),
    event.campaign_id
      ? supabaseAdmin.from('campaigns').select('slug, title').eq('id', event.campaign_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const past = isPast(event.starts_at, event.ends_at);
  const ticketOptions: TicketOption[] = (tickets ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    priceCents: Number(t.price_cents) || 0,
    quantityLimit: t.quantity_limit,
    soldCount: Number(t.sold_count) || 0,
  }));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 64px' }}>
      <Link href="/events" style={{ fontSize: 14, color: 'var(--t3)' }}>← All events</Link>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 8px' }}>
        <Badge color="blue">{eventTypeLabel(event.event_type)}</Badge>
        {event.virtual_url && <Badge color="gray">Virtual</Badge>}
        {past && <Badge color="gray">Past event</Badge>}
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--t1)', marginBottom: 12 }}>{event.title}</h1>

      <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 6 }}>🗓️ {fmtDate(event.starts_at)}{event.ends_at ? ` – ${fmtDate(event.ends_at)}` : ''}</div>
      {event.location && <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 6 }}>📍 {event.location}</div>}
      {event.virtual_url && <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 6 }}>💻 Online event</div>}
      <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 20 }}>{registrationCount ?? 0} registered</div>

      {campaign && (
        <div style={{ marginBottom: 20, fontSize: 14 }}>
          Supporting <Link href={`/campaigns/${campaign.slug}`}>{campaign.title}</Link>
        </div>
      )}

      {past ? (
        <div style={{ padding: '14px 18px', background: 'var(--s1, #f8fafc)', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 12, fontSize: 14, color: 'var(--t3)' }}>
          This event has ended. Thank you to everyone who attended.
        </div>
      ) : (
        <EventRegisterClient slug={event.slug} tickets={ticketOptions} />
      )}
    </div>
  );
}
