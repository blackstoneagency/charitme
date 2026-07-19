'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Btn, Input, Select, Badge, Card, EmptyState } from '../../../components/ui';
import { eventTypeLabel } from '../../../lib/events';

export type CampaignOption = { id: string; title: string };

export type ManagedEvent = {
  id: string;
  title: string;
  slug: string;
  eventType: string;
  startsAt: string;
  location: string | null;
  status: string;
  registrations: number;
};

function statusColor(status: string): 'green' | 'red' | 'blue' | 'gray' {
  if (status === 'published') return 'green';
  if (status === 'cancelled') return 'red';
  if (status === 'completed') return 'blue';
  return 'gray';
}

export default function EventsManageClient({ initialEvents, campaigns }: { initialEvents: ManagedEvent[]; campaigns: CampaignOption[] }) {
  const [events, setEvents] = useState<ManagedEvent[]>(initialEvents);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', eventType: 'fundraiser', campaignId: campaigns[0]?.id ?? '', startsAt: '', location: '',
  });

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          eventType: form.eventType,
          campaignId: form.campaignId,
          startsAt: new Date(form.startsAt).toISOString(),
          location: form.location.trim() || undefined,
          status: 'draft',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not create event'); return; }
      const ev = data.event;
      setEvents((prev) => [
        { id: ev.id, title: ev.title, slug: ev.slug, eventType: ev.event_type, startsAt: ev.starts_at, location: ev.location, status: ev.status, registrations: 0 },
        ...prev,
      ]);
      setForm({ title: '', eventType: 'fundraiser', campaignId: campaigns[0]?.id ?? '', startsAt: '', location: '' });
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: 'published' | 'draft' | 'cancelled') {
    const res = await fetch(`/api/events/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (res.ok) setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Create an event</h2>
        {campaigns.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)' }}>
            You need a campaign first — events are hosted under a campaign. <Link href="/create">Create a campaign →</Link>
          </p>
        ) : (
          <form onSubmit={createEvent} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title" aria-label="Event title" />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px' }}>
                <Select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} aria-label="Event type">
                  {['fundraiser', 'gala', 'giving_day', 'livestream', 'auction', 'registration'].map((t) => (
                    <option key={t} value={t}>{eventTypeLabel(t)}</option>
                  ))}
                </Select>
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <Select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} aria-label="Campaign">
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
              </div>
            </div>
            <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} aria-label="Start date and time" />
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (or leave blank for virtual)" aria-label="Location" />
            {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}
            <div><Btn type="submit" loading={creating} disabled={creating || form.title.trim().length < 4 || !form.startsAt}>Create draft event</Btn></div>
          </form>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Your events</h2>
        {events.length === 0 ? (
          <EmptyState icon="🎟️" title="No events yet" body="Create a draft event above, then publish it when you're ready." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {ev.status === 'published' ? <Link href={`/events/${ev.slug}`}>{ev.title}</Link> : ev.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                    {eventTypeLabel(ev.eventType)} · {new Date(ev.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {ev.registrations} registered
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge color={statusColor(ev.status)}>{ev.status}</Badge>
                  {ev.status === 'draft' && <Btn size="sm" onClick={() => setStatus(ev.id, 'published')}>Publish</Btn>}
                  {ev.status === 'published' && <Btn size="sm" variant="ghost" onClick={() => setStatus(ev.id, 'draft')}>Unpublish</Btn>}
                  {ev.status !== 'cancelled' && ev.status !== 'completed' && <Btn size="sm" variant="ghost" onClick={() => setStatus(ev.id, 'cancelled')}>Cancel</Btn>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
