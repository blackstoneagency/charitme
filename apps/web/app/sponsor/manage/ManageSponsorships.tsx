'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoneyShort } from '@shared/currencies';
import { Btn, Input, Textarea, Select, Badge, EmptyState } from '../../../components/ui';
import type { OpportunityWithOrganizer, RequestWithNames } from '../../../lib/sponsorships';

const REQ_STATUS_COLOR: Record<string, 'gray' | 'green' | 'red' | 'blue'> = {
  pending: 'blue',
  accepted: 'green',
  declined: 'red',
  withdrawn: 'gray',
  fulfilled: 'green',
};

function CreateForm({ categories, onCreated }: { categories: string[]; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0] ?? 'Community');
  const [benefits, setBenefits] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/sponsorships/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          benefits: benefits || null,
          min_amount_cents: minAmount ? Math.round(Number(minAmount) * 100) : 0,
          target_amount_cents: targetAmount ? Math.round(Number(targetAmount) * 100) : null,
          status: 'open',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not create the opportunity.');
        return;
      }
      setTitle('');
      setDescription('');
      setBenefits('');
      setMinAmount('');
      setTargetAmount('');
      onCreated();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const valid = title.trim().length >= 3 && description.trim().length >= 10;

  return (
    <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 20, marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Post a sponsorship opportunity</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sponsor our youth soccer season" />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Who are you, what are you raising for, and why sponsor you?"
        />
        <Textarea
          label="What sponsors receive (optional)"
          value={benefits}
          onChange={(e) => setBenefits(e.target.value)}
          rows={2}
          placeholder="Logo on jerseys, social shout-outs, event booth…"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Input label="Minimum (USD)" type="number" min={0} step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
          <Input label="Target (USD, optional)" type="number" min={0} step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="e.g. 5000" />
        </div>
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13 }}>{error}</p>}
        <div>
          <Btn disabled={!valid || saving} onClick={save}>
            {saving ? 'Posting…' : 'Post opportunity'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function RequestsList({ opportunityId, currency }: { opportunityId: string; currency: string }) {
  const [reqs, setReqs] = useState<RequestWithNames[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/sponsorships/requests?opportunityId=${opportunityId}`);
    const json = res.ok ? await res.json() : { requests: [] };
    setReqs(json.requests ?? []);
  }, [opportunityId]);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/sponsorships/requests?opportunityId=${opportunityId}`)
      .then((res) => (res.ok ? res.json() : { requests: [] }))
      .then((json: { requests?: RequestWithNames[] }) => {
        if (!cancelled) setReqs(json.requests ?? []);
      })
      .catch(() => {
        if (!cancelled) setReqs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  async function act(id: string, status: string) {
    setBusyId(id);
    try {
      await fetch(`/api/sponsorships/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  if (reqs === null) return <p style={{ fontSize: 13, color: 'var(--t4)', padding: '8px 0' }}>Loading offers…</p>;
  if (reqs.length === 0) return <p style={{ fontSize: 13, color: 'var(--t4)', padding: '8px 0' }}>No sponsorship offers yet.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
      {reqs.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '10px 12px',
            border: '1px solid var(--b2)',
            borderRadius: 'var(--r)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {r.company_name || r.sponsor_name || r.sponsor_email || 'Sponsor'} ·{' '}
              {formatMoneyShort(r.amount_cents, currency)}{' '}
              <Badge color={REQ_STATUS_COLOR[r.status] ?? 'gray'}>{r.status}</Badge>
            </div>
            {r.message && <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>{r.message}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {r.status === 'pending' && (
              <>
                <Btn size="sm" disabled={busyId === r.id} onClick={() => act(r.id, 'accepted')}>Accept</Btn>
                <Btn size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => act(r.id, 'declined')}>Decline</Btn>
              </>
            )}
            {r.status === 'accepted' && (
              <Btn size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => act(r.id, 'fulfilled')}>
                Mark fulfilled
              </Btn>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ManageSponsorships({
  initialOpportunities,
  categories,
}: {
  initialOpportunities: OpportunityWithOrganizer[];
  categories: string[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/sponsorships/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div>
      <CreateForm categories={categories} onCreated={() => router.refresh()} />

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Your opportunities</h2>
      {initialOpportunities.length === 0 ? (
        <EmptyState icon="🤝" title="No opportunities yet" body="Post your first sponsorship opportunity above to start receiving offers." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {initialOpportunities.map((o) => (
            <div key={o.id} style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{o.title}</h3>
                    <Badge color={o.status === 'open' ? 'green' : 'gray'}>{o.status}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t4)', marginTop: 4 }}>
                    {formatMoneyShort(o.raised_amount_cents, o.currency)} committed
                    {o.target_amount_cents ? ` of ${formatMoneyShort(o.target_amount_cents, o.currency)}` : ''} · {o.category}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Btn size="sm" variant="ghost" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    {expanded === o.id ? 'Hide offers' : 'View offers'}
                  </Btn>
                  {o.status === 'open' ? (
                    <Btn size="sm" variant="ghost" onClick={() => setStatus(o.id, 'closed')}>Close</Btn>
                  ) : o.status === 'closed' ? (
                    <Btn size="sm" variant="ghost" onClick={() => setStatus(o.id, 'open')}>Reopen</Btn>
                  ) : null}
                </div>
              </div>
              {expanded === o.id && <RequestsList opportunityId={o.id} currency={o.currency} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
