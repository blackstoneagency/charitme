'use client';

import { useState } from 'react';
import { Btn, Input, Card, Badge } from '../../../components/ui';
import DegradedReadNotice from '../../../components/DegradedReadNotice';

export type Incident = {
  id: string;
  title: string;
  component: string;
  status: string;
  impact: string;
  started_at: string;
  resolved_at: string | null;
};

export type MaintenanceWindow = {
  id: string;
  title: string;
  description: string | null;
  component: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

const STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
const IMPACTS = ['minor', 'major', 'critical'] as const;

export default function IncidentsClient({
  initialIncidents,
  initialWindows,
}: {
  initialIncidents: Incident[] | null;
  initialWindows: MaintenanceWindow[] | null;
}) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents ?? []);
  const [windows, setWindows] = useState<MaintenanceWindow[]>(initialWindows ?? []);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [impact, setImpact] = useState<(typeof IMPACTS)[number]>('minor');

  const [mTitle, setMTitle] = useState('');
  const [mStart, setMStart] = useState('');
  const [mEnd, setMEnd] = useState('');

  // Both reads failing means the migration is almost certainly unapplied, which
  // is a different problem from a transient error — say so rather than showing
  // two empty lists that imply a quiet platform.
  if (initialIncidents === null && initialWindows === null) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <DegradedReadNotice title="Incidents and maintenance are unavailable">
          Neither table could be read. If this is a new deploy, the
          <code> 20260820000000_incidents_and_maintenance </code> migration has probably not been
          applied yet. Until it is, the public status page reports incident history as unknown
          rather than claiming there have been none.
        </DegradedReadNotice>
      </div>
    );
  }

  async function openIncident(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, impact }),
      });
      const data: { incident?: Incident; error?: string } = await res.json();
      if (!res.ok || !data.incident) throw new Error(data.error ?? 'Could not open the incident');
      setIncidents((prev) => [data.incident as Incident, ...prev]);
      setTitle('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setErr('');
    const res = await fetch('/api/admin/incidents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const data: { incident?: Incident; error?: string } = await res.json();
    if (data.incident) setIncidents((prev) => prev.map((i) => (i.id === id ? (data.incident as Incident) : i)));
    if (!res.ok) setErr(data.error ?? 'Could not update the incident');
  }

  async function scheduleWindow(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mTitle,
          startsAt: new Date(mStart).toISOString(),
          endsAt: new Date(mEnd).toISOString(),
        }),
      });
      const data: { window?: MaintenanceWindow; error?: string } = await res.json();
      if (!res.ok || !data.window) throw new Error(data.error ?? 'Could not schedule the window');
      setWindows((prev) => [data.window as MaintenanceWindow, ...prev]);
      setMTitle('');
      setMStart('');
      setMEnd('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 900 }}>
      {/* ⚠️ The <h1> that was here is now the shell's TopBar title. Keeping both
          put two competing headings on the page. Only the status-page LINK
          survives, because TopBar's subtitle is plain text and cannot carry it. */}
      <p style={{ margin: 0, color: 'var(--t3)', fontSize: 14 }}>
        Everything here is published on the public{' '}
        <a href="/status" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
          status page
        </a>{' '}
        immediately.
      </p>

      {err && (
        <p role="alert" style={{ color: 'var(--red)', fontSize: 14, margin: 0 }}>
          {err}
        </p>
      )}

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Open an incident</h2>
        <form onSubmit={openIncident} style={{ display: 'flex', minWidth: 0, gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <label htmlFor="inc-title" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              What is happening?
            </label>
            <Input
              id="inc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Donations are failing at checkout"
              maxLength={200}
              required
            />
          </div>
          <div>
            <label htmlFor="inc-impact" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Impact
            </label>
            <select
              id="inc-impact"
              value={impact}
              onChange={(e) => setImpact(e.target.value as (typeof IMPACTS)[number])}
              style={{
                minHeight: 44,
                padding: '10px 12px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--b2)',
                background: 'var(--s1)',
                color: 'var(--t1)',
              }}
            >
              {IMPACTS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <Btn type="submit" disabled={busy || title.trim().length < 3}>
            Open incident
          </Btn>
        </form>
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Incidents</h2>
        {initialIncidents === null ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>
            Incidents could not be loaded — this is not the same as there being none.
          </p>
        ) : incidents.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: 0 }}>No incidents recorded.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            {incidents.map((inc) => (
              <li
                key={inc.id}
                style={{
                  border: '1px solid var(--b2)',
                  borderRadius: 'var(--r)',
                  padding: 12,
                  display: 'flex', minWidth: 0,
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>{inc.title}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--t3)' }}>
                    {inc.impact} · started {new Date(inc.started_at).toUTCString()}
                  </p>
                </div>
                <Badge>{inc.resolved_at ? 'resolved' : inc.status}</Badge>
                <label className="kf-sr-only" htmlFor={`st-${inc.id}`}>
                  Status for {inc.title}
                </label>
                <select
                  id={`st-${inc.id}`}
                  value={inc.status}
                  onChange={(e) => setStatus(inc.id, e.target.value)}
                  style={{
                    minHeight: 44,
                    padding: '8px 10px',
                    borderRadius: 'var(--r)',
                    border: '1px solid var(--b2)',
                    background: 'var(--s1)',
                    color: 'var(--t1)',
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Schedule maintenance</h2>
        <form onSubmit={scheduleWindow} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
          <div>
            <label htmlFor="mw-title" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Title
            </label>
            <Input
              id="mw-title"
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              placeholder="Database upgrade"
              maxLength={200}
              required
            />
          </div>
          <div style={{ display: 'flex', minWidth: 0, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="mw-start" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                Starts
              </label>
              <Input id="mw-start" type="datetime-local" value={mStart} onChange={(e) => setMStart(e.target.value)} required />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor="mw-end" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                Ends
              </label>
              <Input id="mw-end" type="datetime-local" value={mEnd} onChange={(e) => setMEnd(e.target.value)} required />
            </div>
          </div>
          <div>
            <Btn type="submit" disabled={busy || !mTitle || !mStart || !mEnd}>
              Schedule
            </Btn>
          </div>
        </form>

        {initialWindows === null ? (
          <p style={{ fontSize: 14, color: 'var(--t3)', margin: '14px 0 0' }}>
            Scheduled windows could not be loaded.
          </p>
        ) : windows.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
            {windows.map((w) => (
              <li key={w.id} style={{ fontSize: 13, color: 'var(--t2)' }}>
                <strong style={{ color: 'var(--t1)' }}>{w.title}</strong> — {new Date(w.starts_at).toUTCString()} →{' '}
                {new Date(w.ends_at).toUTCString()} ({w.status})
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
