'use client';

import { useState } from 'react';
import { currencySymbol } from '@shared/currencies';
import { Btn, Input, Textarea, Badge, Card, EmptyState } from '../../../components/ui';
import { sponsorshipStatusLabel, type SponsorshipRequestStatus } from '../../../lib/sponsorships';

export type SponsorRequest = {
  id: string;
  sponsorName: string;
  amountCents: number;
  message: string | null;
  status: string;
};

export type ManagedOpportunity = {
  id: string;
  title: string;
  description: string | null;
  benefits: string[];
  minAmountCents: number;
  currency: string;
  slots: number;
  status: string;
  requests: SponsorRequest[];
};

function statusColor(status: string): 'green' | 'red' | 'blue' | 'gray' {
  if (status === 'agreed' || status === 'fulfilled') return 'green';
  if (status === 'declined' || status === 'withdrawn') return 'red';
  if (status === 'accepted') return 'blue';
  return 'gray';
}

export default function SponsorshipsManageClient({ initialOpportunities }: { initialOpportunities: ManagedOpportunity[] }) {
  const [opportunities, setOpportunities] = useState<ManagedOpportunity[]>(initialOpportunities);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', benefits: '', minAmount: '', slots: '1' });

  function fmt(cents: number, currency: string) {
    return `${currencySymbol(currency)}${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  async function createOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/sponsorships/opportunities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          benefits: form.benefits,
          minAmountCents: form.minAmount.trim() ? Math.max(0, Math.round(parseFloat(form.minAmount) * 100)) : 0,
          slots: Math.max(1, parseInt(form.slots, 10) || 1),
          status: 'open',
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not create opportunity'); return; }
      const o = data.opportunity;
      setOpportunities((prev) => [
        { id: o.id, title: o.title, description: o.description, benefits: o.benefits ?? [], minAmountCents: o.min_amount_cents, currency: o.currency ?? 'usd', slots: o.slots, status: o.status, requests: [] },
        ...prev,
      ]);
      setForm({ title: '', description: '', benefits: '', minAmount: '', slots: '1' });
    } finally {
      setCreating(false);
    }
  }

  async function updateRequest(oppId: string, reqId: string, status: SponsorshipRequestStatus) {
    const res = await fetch(`/api/sponsorships/requests/${reqId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    setOpportunities((prev) => prev.map((o) => (o.id !== oppId ? o : { ...o, requests: o.requests.map((r) => (r.id === reqId ? { ...r, status } : r)) })));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Post a sponsorship package</h2>
        <form onSubmit={createOpportunity} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Package title (e.g. Gold event sponsor)" aria-label="Package title" />
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the sponsorship and what it supports." aria-label="Description" />
          <Input value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="Benefits, comma separated (e.g. Logo on page, Social shoutout)" aria-label="Benefits" />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <Input type="number" min={0} value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} placeholder="Minimum amount ($)" aria-label="Minimum amount" />
            </div>
            <div style={{ flex: '0 0 110px' }}>
              <Input type="number" min={1} value={form.slots} onChange={(e) => setForm({ ...form, slots: e.target.value })} aria-label="Slots" />
            </div>
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>}
          <div><Btn type="submit" loading={creating} disabled={creating || form.title.trim().length < 4}>Publish package</Btn></div>
        </form>
      </Card>

      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Your packages</h2>
        {opportunities.length === 0 ? (
          <EmptyState icon="🤝" title="No sponsorship packages yet" body="Post a package above to start attracting sponsors." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {opportunities.map((o) => {
              const committed = o.requests.filter((r) => ['accepted', 'agreed', 'fulfilled'].includes(r.status)).length;
              return (
                <div key={o.id} style={{ border: '1px solid var(--b2, #e5e7eb)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{o.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                        From {fmt(o.minAmountCents, o.currency)} · {committed}/{o.slots} committed · {o.requests.length} offer{o.requests.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <Badge color={o.status === 'open' ? 'green' : 'gray'}>{o.status}</Badge>
                  </div>

                  {o.requests.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {o.requests.map((r) => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', background: 'var(--s1, #f8fafc)', borderRadius: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <span style={{ fontWeight: 600 }}>{r.sponsorName}</span>
                            <span style={{ fontSize: 12, color: 'var(--t3)' }}> · {fmt(r.amountCents, o.currency)}</span>
                            {r.message && <span style={{ fontSize: 12, color: 'var(--t3)' }}> — {r.message}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Badge color={statusColor(r.status)}>{sponsorshipStatusLabel(r.status as SponsorshipRequestStatus)}</Badge>
                            {r.status === 'pending' && (
                              <>
                                <Btn size="sm" onClick={() => updateRequest(o.id, r.id, 'accepted')}>Accept</Btn>
                                <Btn size="sm" variant="ghost" onClick={() => updateRequest(o.id, r.id, 'declined')}>Decline</Btn>
                              </>
                            )}
                            {r.status === 'agreed' && (
                              <Btn size="sm" variant="ghost" onClick={() => updateRequest(o.id, r.id, 'fulfilled')}>Mark fulfilled</Btn>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
