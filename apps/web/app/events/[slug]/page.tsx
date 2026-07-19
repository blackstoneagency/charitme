import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '../../../components/ui';
import { getUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { getEventBySlug, attendeeRegisteredQty } from '../../../lib/events';
import { isRegistrationOpen, remainingCapacity } from '../../../lib/events-core';
import RsvpPanel from './RsvpPanel';

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

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: 780 }}>
      <Link href="/events" style={{ fontSize: 14, color: 'var(--t3)', textDecoration: 'none' }}>← All events</Link>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0 12px' }}>
        <Badge color="blue">{e.event_type.replace('_', ' ')}</Badge>
        {e.virtual_url ? <Badge color="green">Virtual</Badge> : e.location ? <Badge color="gray">{e.location}</Badge> : null}
        {Number.isFinite(remaining) && (remaining > 0 ? <Badge color="green">{remaining} spots left</Badge> : <Badge color="red">Full</Badge>)}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{e.title}</h1>
      <div style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 4 }}>🗓 {dateLabel(e.starts_at)}</div>
      {e.location && <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 4 }}>📍 {e.location}</div>}
      {e.virtual_url && open && (
        <div style={{ fontSize: 14, marginBottom: 4 }}>
          🔗 <a href={e.virtual_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green-dark)' }}>Join link</a>
        </div>
      )}

      {e.description && (
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--t2)', whiteSpace: 'pre-wrap', marginTop: 18 }}>{e.description}</p>
      )}

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--b2)' }}>
        <RsvpPanel
          eventId={e.id}
          signedIn={!!user}
          isOrganizer={isOrganizer}
          open={open}
          alreadyRegistered={alreadyRegistered}
          slug={e.slug}
        />
      </div>
    </div>
  );
}
