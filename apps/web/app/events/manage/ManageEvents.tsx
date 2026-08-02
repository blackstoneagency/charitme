'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, Input, Textarea, Select, Badge, EmptyState } from '../../../components/ui';
import type { EventWithCounts, RegistrationWithCheckin } from '../../../lib/events';

function toLocalInput(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function CreateForm({ eventTypes, onCreated }: { eventTypes: string[]; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState(eventTypes[0] ?? 'fundraiser');
  const [startsAt, setStartsAt] = useState(toLocalInput());
  const [location, setLocation] = useState('');
  const [virtualUrl, setVirtualUrl] = useState('');
  const [capacity, setCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          event_type: eventType,
          starts_at: new Date(startsAt).toISOString(),
          location: location || null,
          virtual_url: virtualUrl || null,
          capacity: capacity ? Number(capacity) : null,
          status: 'published',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not create the event.');
        return;
      }
      setTitle('');
      setDescription('');
      setLocation('');
      setVirtualUrl('');
      setCapacity('');
      onCreated();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const valid = title.trim().length >= 3 && !!startsAt;

  return (
    <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 20, marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Host an event</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spring Charity Gala" />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's the event, and what will it support?" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <Select label="Type" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {eventTypes.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </Select>
          <Input label="Starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Input label="Capacity (blank = unlimited)" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <Input label="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue, City" />
          <Input label="Virtual link (optional)" value={virtualUrl} onChange={(e) => setVirtualUrl(e.target.value)} placeholder="https://…" />
        </div>
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13 }}>{error}</p>}
        <div>
          <Btn disabled={!valid || saving} onClick={save}>{saving ? 'Publishing…' : 'Publish event'}</Btn>
        </div>
      </div>
    </div>
  );
}

function Attendees({ eventId }: { eventId: string }) {
  const [regs, setRegs] = useState<RegistrationWithCheckin[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // A failed read used to become `[]`, which renders "No registrations yet." —
  // told to an organizer standing at the door of a sold-out event. Failure and
  // emptiness are now different states.
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/events/${eventId}/registrations`);
    if (!res.ok) {
      setLoadFailed(true);
      return;
    }
    const json = await res.json();
    setRegs(json.registrations ?? []);
    setLoadFailed(false);
  }

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/registrations`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((json: { registrations?: RegistrationWithCheckin[] }) => {
        if (cancelled) return;
        setRegs(json.registrations ?? []);
        setLoadFailed(false);
      })
      .catch(() => { if (!cancelled) { setRegs([]); setLoadFailed(true); } });
    return () => { cancelled = true; };
  }, [eventId]);

  async function toggle(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      // The response was previously discarded, so a rejected check-in looked
      // identical to a successful one — the worst possible failure mode for
      // someone working a door.
      const res = await fetch(`/api/events/registrations/${id}/checkin`, { method: 'POST' });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setActionError((detail as { error?: string }).error ?? 'Could not update check-in. Try again.');
        return;
      }
      await reload();
    } catch {
      setActionError('Network error — check-in was not saved.');
    } finally {
      setBusyId(null);
    }
  }

  if (regs === null && !loadFailed) return <p style={{ fontSize: 13, color: 'var(--t4)', padding: '8px 0' }}>Loading attendees…</p>;
  if (loadFailed) {
    return (
      <p role="alert" style={{ fontSize: 13, color: 'var(--t1)', padding: '10px 12px', marginTop: 12, border: '1px solid var(--b2)', borderRadius: 'var(--r)', background: 'var(--s2)' }}>
        <strong>We couldn&apos;t load your attendee list.</strong>{' '}
        No registrations have been lost — this is a temporary problem on our side.
        Reload before telling anyone they are not on the list.
      </p>
    );
  }
  if (regs!.length === 0) return <p style={{ fontSize: 13, color: 'var(--t4)', padding: '8px 0' }}>No registrations yet.</p>;

  const checkedIn = regs!.filter((r) => r.checked_in).length;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--t4)', marginBottom: 8 }}>{checkedIn}/{regs!.length} checked in</div>
      {actionError && (
        <p role="alert" style={{ fontSize: 13, color: 'var(--red-text)', margin: '0 0 8px' }}>{actionError}</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {regs!.map((r) => (
          <div key={r.id} style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 12px', border: '1px solid var(--b2)', borderRadius: 'var(--r)' }}>
            <div style={{ fontSize: 14 }}>
              {r.attendee_name || r.attendee_email || 'Guest'}
              {r.quantity > 1 && <span style={{ color: 'var(--t4)' }}> ×{r.quantity}</span>}{' '}
              {r.checked_in && <Badge color="green">checked in</Badge>}
            </div>
            <Btn size="sm" variant={r.checked_in ? 'ghost' : 'secondary'} disabled={busyId === r.id} onClick={() => toggle(r.id)}>
              {r.checked_in ? 'Undo' : 'Check in'}
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ManageEvents({ initialEvents, eventTypes }: { initialEvents: EventWithCounts[]; eventTypes: string[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div>
      <CreateForm eventTypes={eventTypes} onCreated={() => router.refresh()} />

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Your events</h2>
      {initialEvents.length === 0 ? (
        <EmptyState icon="📅" title="No events yet" body="Host your first event above to start collecting RSVPs." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {initialEvents.map((e) => (
            <div key={e.id} style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 18 }}>
              <div style={{ display: 'flex', minWidth: 0, justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{e.title}</h3>
                    <Badge color={e.status === 'published' ? 'green' : 'gray'}>{e.status}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t4)', marginTop: 4 }}>
                    {new Date(e.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    {' · '}{e.registered_qty} registered{e.capacity ? ` / ${e.capacity}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', minWidth: 0, gap: 8, alignItems: 'flex-start' }}>
                  <Btn size="sm" variant="ghost" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    {expanded === e.id ? 'Hide attendees' : 'Attendees'}
                  </Btn>
                  {e.status === 'published' ? (
                    <Btn size="sm" variant="ghost" onClick={() => setStatus(e.id, 'completed')}>Complete</Btn>
                  ) : e.status === 'draft' ? (
                    <Btn size="sm" variant="ghost" onClick={() => setStatus(e.id, 'published')}>Publish</Btn>
                  ) : null}
                </div>
              </div>
              {expanded === e.id && <Attendees eventId={e.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
