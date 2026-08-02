'use client';

import { useState } from 'react';
import { Btn, Input, Card, EmptyState, Badge } from '../../../components/ui';
import DegradedReadNotice from '../../../components/DegradedReadNotice';

export type CustomDomain = {
  id: string;
  domain: string;
  verification_token: string;
  status: 'pending' | 'verified' | 'failed';
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
};

export default function DomainsClient({
  initialDomains,
  txtPrefix,
}: {
  initialDomains: CustomDomain[] | null;
  txtPrefix: string;
}) {
  const [domains, setDomains] = useState<CustomDomain[]>(initialDomains ?? []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  if (initialDomains === null) {
    return (
      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        <DegradedReadNotice title="We couldn't load your domains">
          This is a problem reading the database, not a sign your domain was removed. If this is a
          new deploy, the <code>20260823000000_custom_domains</code> migration may not be applied.
        </DegradedReadNotice>
      </div>
    );
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/custom-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: input }),
      });
      const data: { domain?: CustomDomain; error?: string } = await res.json();
      if (!res.ok || !data.domain) throw new Error(data.error ?? 'Could not add the domain');
      setDomains((prev) => [data.domain as CustomDomain, ...prev]);
      setInput('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function check(id: string) {
    setCheckingId(id);
    setErr('');
    try {
      const res = await fetch('/api/custom-domains', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data: { domain?: CustomDomain; verified?: boolean; reason?: string | null; error?: string } =
        await res.json();
      if (!res.ok || !data.domain) throw new Error(data.error ?? 'Could not check DNS');
      setDomains((prev) => prev.map((d) => (d.id === id ? (data.domain as CustomDomain) : d)));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setCheckingId(null);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/custom-domains?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) setDomains((prev) => prev.filter((d) => d.id !== id));
    else setErr('Could not remove the domain');
  }

  return (
    <div className="kf-admin-dash" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20, maxWidth: 860 }}>
      {/* The limit is stated up front, not discovered after verification. */}
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
        <strong style={{ color: 'var(--t1)' }}>What verification here does.</strong> We check a DNS
        record to prove you own the domain — that check is real and runs against live DNS. Making the
        domain actually serve your campaign is a separate step you take with your hosting provider,
        which issues the certificate and points traffic at us.
      </div>

      {err && (
        <p role="alert" style={{ color: 'var(--red)', fontSize: 14, margin: 0 }}>
          {err}
        </p>
      )}

      <Card>
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Add a domain</h2>
        <form onSubmit={add} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <label htmlFor="dom" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Domain
            </label>
            <Input
              id="dom"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="give.example.org"
              required
            />
          </div>
          <Btn type="submit" disabled={busy || input.trim().length < 3}>
            {busy ? 'Adding…' : 'Add domain'}
          </Btn>
        </form>
      </Card>

      {domains.length === 0 ? (
        <EmptyState title="No domains yet" body="Add one above and we'll show you the DNS record to create." />
      ) : (
        domains.map((d) => (
          <Card key={d.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <strong style={{ fontSize: 16, flex: '1 1 auto', wordBreak: 'break-all' }}>{d.domain}</strong>
              <Badge>{d.status === 'verified' ? 'Verified' : 'Awaiting DNS'}</Badge>
              <Btn type="button" onClick={() => check(d.id)} disabled={checkingId === d.id}>
                {checkingId === d.id ? 'Checking DNS…' : 'Check now'}
              </Btn>
              <Btn type="button" variant="secondary" onClick={() => remove(d.id)}>
                Remove
              </Btn>
            </div>

            {d.status === 'verified' ? (
              <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0 }}>
                Ownership confirmed{d.verified_at ? ` on ${new Date(d.verified_at).toUTCString()}` : ''}. Next,
                add this domain in your hosting provider so it points at CharitMe.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--t2)', margin: '0 0 8px' }}>
                  Create this TXT record at your DNS provider, then choose <em>Check now</em>:
                </p>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 6, fontSize: 13 }}>
                  <div>
                    <dt style={{ color: 'var(--t3)' }}>Name</dt>
                    <dd style={{ margin: 0, fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                      {txtPrefix}.{d.domain}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: 'var(--t3)' }}>Value</dt>
                    <dd style={{ margin: 0, fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>
                      {d.verification_token}
                    </dd>
                  </div>
                </dl>
                {/* The reason the last check failed, verbatim. "Not verified"
                    with no explanation is the most common way this feature
                    wastes someone's afternoon. */}
                {d.last_error && (
                  <p style={{ fontSize: 12, color: 'var(--t3)', margin: '10px 0 0' }}>
                    Last check{d.last_checked_at ? ` (${new Date(d.last_checked_at).toUTCString()})` : ''}:{' '}
                    {d.last_error}
                  </p>
                )}
              </>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
