'use client';

import { useState } from 'react';
import { Btn, Input, Card, EmptyState, Badge } from '../../../components/ui';
import DegradedReadNotice from '../../../components/DegradedReadNotice';

export type WebhookEndpoint = {
  id: string;
  owner_id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

// Mirrors WEBHOOK_EVENTS in lib/webhook-endpoint-access.ts. The server rejects
// anything outside its own list, so a drift here shows up as a 400 rather than
// as an endpoint that silently never matches.
const EVENTS = [
  'donation.created',
  'donation.refunded',
  'campaign.published',
  'campaign.goal_reached',
  'payout.paid',
];

export default function WebhooksClient({
  initialEndpoints,
}: {
  initialEndpoints: WebhookEndpoint[] | null;
}) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(initialEndpoints ?? []);
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<string[]>(['donation.created']);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (initialEndpoints === null) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <DegradedReadNotice title="We couldn't load your webhook endpoints">
          This is a temporary problem reading the database, not a sign your endpoints were removed.
          Reload before adding one, so you don&apos;t register a duplicate.
        </DegradedReadNotice>
      </div>
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setNewSecret(null);
    try {
      const res = await fetch('/api/webhook-endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events: selected }),
      });
      const data: { endpoint?: WebhookEndpoint; secret?: string; error?: string } = await res.json();
      if (!res.ok || !data.endpoint) throw new Error(data.error ?? 'Could not add the endpoint');
      setEndpoints((prev) => [data.endpoint as WebhookEndpoint, ...prev]);
      setNewSecret(data.secret ?? null);
      setUrl('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(ep: WebhookEndpoint) {
    const res = await fetch(`/api/webhook-endpoints/${ep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !ep.active }),
    });
    const data: { endpoint?: WebhookEndpoint; error?: string } = await res.json();
    if (res.ok && data.endpoint) {
      setEndpoints((prev) => prev.map((x) => (x.id === ep.id ? (data.endpoint as WebhookEndpoint) : x)));
    } else {
      setErr(data.error ?? 'Could not update the endpoint');
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/webhook-endpoints/${id}`, { method: 'DELETE' });
    if (res.ok) setEndpoints((prev) => prev.filter((x) => x.id !== id));
    else {
      const data: { error?: string } = await res.json().catch(() => ({}));
      setErr(data.error ?? 'Could not delete the endpoint');
    }
  }

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 860 }}>
      {/* Stated up front rather than implied by an empty "Last triggered"
          column. Nothing dispatches these yet, and the stored `secret_hash`
          cannot be used to sign a payload — see the page comment. */}
      <div
        role="note"
        style={{
          border: '1px solid var(--b2)',
          borderLeft: '3px solid var(--blue)',
          borderRadius: 'var(--r)',
          padding: '12px 14px',
          background: 'var(--s2)',
          fontSize: 14,
          color: 'var(--t2)',
        }}
      >
        <strong style={{ color: 'var(--t1)' }}>Event delivery isn&apos;t switched on yet.</strong>{' '}
        You can register and manage endpoints here now, and they&apos;re stored against your account
        — but CharitMe is not sending events to them yet. We&apos;d rather say so than show you a
        delivery log that isn&apos;t real.
      </div>

      {err && (
        <p role="alert" style={{ color: 'var(--red)', fontSize: 14, margin: 0 }}>
          {err}
        </p>
      )}

      {newSecret && (
        <Card>
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Copy your signing secret now</h2>
          <p style={{ fontSize: 13, color: 'var(--t2)', margin: '0 0 10px' }}>
            This is the only time it will be shown. We store a hash of it, so we cannot show it to
            you again — if you lose it, delete the endpoint and create a new one.
          </p>
          <code
            style={{
              display: 'block',
              fontFamily: 'var(--mono)',
              fontSize: 13,
              padding: 10,
              borderRadius: 'var(--r)',
              background: 'var(--s3)',
              color: 'var(--t1)',
              wordBreak: 'break-all',
            }}
          >
            {newSecret}
          </code>
        </Card>
      )}

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Add an endpoint</h2>
        <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <div>
            <label htmlFor="wh-url" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Endpoint URL
            </label>
            <Input
              id="wh-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/charitme"
              required
              aria-describedby="wh-url-help"
            />
            <p id="wh-url-help" style={{ fontSize: 12, color: 'var(--t3)', margin: '6px 0 0' }}>
              Must be https and reachable from the internet.
            </p>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 13, marginBottom: 6, padding: 0 }}>Events</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
              {EVENTS.map((ev) => (
                <label key={ev} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(ev)}
                    onChange={(e) =>
                      setSelected((prev) => (e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev)))
                    }
                  />
                  <code style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{ev}</code>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Btn type="submit" disabled={busy || !url || selected.length === 0}>
              {busy ? 'Adding…' : 'Add endpoint'}
            </Btn>
          </div>
        </form>
      </Card>

      {endpoints.length === 0 ? (
        <EmptyState title="No endpoints yet" body="Add one above to get started." />
      ) : (
        <Card>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Your endpoints</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {endpoints.map((ep) => (
              <li
                key={ep.id}
                style={{
                  border: '1px solid var(--b2)',
                  borderRadius: 'var(--r)',
                  padding: 12,
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--mono)',
                      fontSize: 13,
                      wordBreak: 'break-all',
                      color: 'var(--t1)',
                    }}
                  >
                    {ep.url}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--t3)' }}>
                    {ep.events.join(', ')}
                  </p>
                </div>
                <Badge>{ep.active ? 'Active' : 'Paused'}</Badge>
                <Btn type="button" variant="secondary" onClick={() => toggle(ep)}>
                  {ep.active ? 'Pause' : 'Resume'}
                </Btn>
                <Btn type="button" variant="secondary" onClick={() => remove(ep.id)}>
                  Delete
                </Btn>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
