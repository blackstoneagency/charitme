'use client';

import React, { useState } from 'react';
import { Btn, Input, Card, Badge, EmptyState } from '../../../../components/ui';

export type ApiKey = {
  id: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

interface Props {
  initialKeys: ApiKey[];
  availableScopes: readonly string[];
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export function DevelopersClient({ initialKeys, availableScopes }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['campaigns:read']);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Held in component state only, and only until the page is left. There is no
  // endpoint that can return it again — the server stored a hash.
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setPlaintext(null);
    setCopied(false);
    try {
      const res = await fetch('/api/developers/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scopes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not create that key.');
        return;
      }
      setKeys((prev) => [json.key, ...prev]);
      setPlaintext(json.plaintext);
      setName('');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/developers/keys?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? 'Could not revoke that key.');
        return;
      }
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)),
      );
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  }

  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
      {plaintext && (
        <Card style={{ border: '1px solid var(--green)', background: 'var(--green-light)' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 15.5, fontWeight: 800, color: 'var(--green-dark)' }}>
            Copy your key now — it cannot be shown again
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--t2)' }}>
            CharitMe stores only a hash of this key, so there is no way to retrieve it later. If you
            lose it, revoke it and create another.
          </p>
          <code
            style={{
              display: 'block',
              fontFamily: 'var(--mono)',
              fontSize: 13,
              background: 'var(--s1)',
              border: '1px solid var(--b1)',
              borderRadius: 'var(--r)',
              padding: '12px 14px',
              wordBreak: 'break-all',
              color: 'var(--t1)',
            }}
          >
            {plaintext}
          </code>
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <Btn
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(plaintext);
                  setCopied(true);
                } catch {
                  // Clipboard can be blocked by permissions policy. The key is
                  // on screen and selectable, so this is not a dead end.
                  setCopied(false);
                }
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => setPlaintext(null)}>
              I&apos;ve saved it
            </Btn>
          </div>
        </Card>
      )}

      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>Create an API key</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.55 }}>
          Keys are read-only and scoped to your own data. Send one as{' '}
          <code style={{ fontFamily: 'var(--mono)' }}>Authorization: Bearer …</code>.
        </p>

        <form onSubmit={createKey} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <Input
            label="Key name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Zapier integration"
            required
            hint="So you can tell your keys apart later."
          />
          <fieldset style={{ border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: '12px 14px', margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', padding: '0 6px' }}>Scopes</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
              {availableScopes.map((s) => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--t2)' }}>
                  <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                  <code style={{ fontFamily: 'var(--mono)' }}>{s}</code>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{error}</p>}
          <div>
            <Btn type="submit" loading={creating} disabled={scopes.length === 0}>
              Create key
            </Btn>
          </div>
        </form>
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 18px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>Your keys</h2>
        {keys.length === 0 ? (
          <EmptyState title="No API keys yet" body="Create one above to start using the CharitMe API." />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
            {[...active, ...revoked].map((k) => (
              <li
                key={k.id}
                style={{
                  border: '1px solid var(--b1)',
                  borderRadius: 'var(--rl)',
                  padding: 14,
                  background: 'var(--s1)',
                  display: 'flex',
                  gap: 14,
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  opacity: k.revoked_at ? 0.6 : 1,
                }}
              >
                <div style={{ minWidth: 220, flex: '1 1 260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14.5, color: 'var(--t1)' }}>{k.name}</strong>
                    <Badge color={k.revoked_at ? 'gray' : 'green'}>{k.revoked_at ? 'Revoked' : 'Active'}</Badge>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--t3)' }}>
                    {k.scopes.join(', ') || 'no scopes'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--t4)' }}>
                    Created {fmt(k.created_at)} · Last used {fmt(k.last_used_at)}
                  </p>
                </div>
                {!k.revoked_at && (
                  <Btn variant="secondary" size="sm" loading={busyId === k.id} onClick={() => revoke(k.id)}>
                    Revoke
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
