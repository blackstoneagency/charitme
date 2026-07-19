'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { currencySymbol } from '@shared/currencies';
import { Btn, Input, Textarea, Badge, Card, EmptyState } from '../../components/ui';

export type SponsorshipCard = {
  id: string;
  title: string;
  description: string | null;
  benefits: string[];
  minAmountCents: number;
  currency: string;
  slots: number;
};

export default function SponsorBrowseClient({ opportunities }: { opportunities: SponsorshipCard[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return opportunities;
    return opportunities.filter((o) => o.title.toLowerCase().includes(n) || (o.description ?? '').toLowerCase().includes(n));
  }, [opportunities, q]);

  function fmt(cents: number, currency: string) {
    return `${currencySymbol(currency)}${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  async function submitOffer(o: SponsorshipCard) {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents < o.minAmountCents) {
      setError(`Offer must be at least ${fmt(o.minAmountCents, o.currency)}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sponsorships/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: o.id, amountCents: cents, message: message.trim() || undefined }),
      });
      if (res.status === 401) { router.push('/login?next=/sponsor'); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not submit offer'); return; }
      setDone((d) => ({ ...d, [o.id]: true }));
      setOpenId(null);
      setAmount('');
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20, maxWidth: 420 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sponsorship opportunities" aria-label="Search sponsorships" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🤝" title="No opportunities yet" body={opportunities.length === 0 ? 'No open sponsorships right now — check back soon.' : 'Try a different search.'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map((o) => (
            <Card key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge color="green">From {fmt(o.minAmountCents, o.currency)}</Badge>
                <Badge color="gray">{o.slots} {o.slots === 1 ? 'slot' : 'slots'}</Badge>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{o.title}</h3>
              {o.description && <p style={{ fontSize: 14, color: 'var(--t3)' }}>{o.description}</p>}
              {o.benefits.length > 0 && (
                <ul style={{ fontSize: 13, color: 'var(--t2)', paddingLeft: 18, margin: 0 }}>
                  {o.benefits.slice(0, 5).map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                {done[o.id] ? (
                  <Badge color="green">Offer submitted ✓</Badge>
                ) : openId === o.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Input type="number" min={o.minAmountCents / 100} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount (${currencySymbol(o.currency)})`} aria-label="Sponsorship amount" />
                    <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message to the organizer (optional)" aria-label="Message" />
                    {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn onClick={() => submitOffer(o)} loading={busy} disabled={busy}>Submit offer</Btn>
                      <Btn variant="ghost" onClick={() => { setOpenId(null); setError(null); }}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <Btn onClick={() => { setOpenId(o.id); setError(null); }}>Offer to sponsor</Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
