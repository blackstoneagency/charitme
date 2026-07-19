'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoneyShort } from '@shared/currencies';
import { Btn, Input, Textarea, Badge, EmptyState } from '../../../components/ui';
import type { ProgramWithSponsor, ClaimWithNames } from '../../../lib/matching';

const CLAIM_STATUS_COLOR: Record<string, 'gray' | 'green' | 'red' | 'blue'> = {
  pending: 'blue',
  approved: 'green',
  declined: 'red',
  paid: 'green',
};

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [ratio, setRatio] = useState('1');
  const [cap, setCap] = useState('');
  const [minDonation, setMinDonation] = useState('');
  const [categories, setCategories] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/matching/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: company,
          description: description || null,
          match_ratio: Number(ratio) || 1,
          annual_cap_cents: cap ? Math.round(Number(cap) * 100) : 0,
          min_donation_cents: minDonation ? Math.round(Number(minDonation) * 100) : 0,
          categories: categories.split(',').map((c) => c.trim()).filter(Boolean),
          status: 'active',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not create the program.');
        return;
      }
      setCompany('');
      setDescription('');
      setRatio('1');
      setCap('');
      setMinDonation('');
      setCategories('');
      onCreated();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const valid = company.trim().length >= 2 && Number(ratio) > 0;

  return (
    <div style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 20, marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Launch a matching program</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Company name" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
        <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="How the program works, who's eligible…" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <Input label="Match ratio (×)" type="number" min={0.1} step="0.1" value={ratio} onChange={(e) => setRatio(e.target.value)} />
          <Input label="Annual cap / employee (USD)" type="number" min={0} step="1" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="0 = uncapped" />
          <Input label="Min donation (USD)" type="number" min={0} step="0.01" value={minDonation} onChange={(e) => setMinDonation(e.target.value)} />
        </div>
        <Input label="Eligible categories (comma-separated, blank = all)" value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Education, Medical, Environment" />
        {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
        <div>
          <Btn disabled={!valid || saving} onClick={save}>
            {saving ? 'Launching…' : 'Launch program'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ClaimsList({ programId, currency }: { programId: string; currency: string }) {
  const [claims, setClaims] = useState<ClaimWithNames[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/matching/claims?programId=${programId}`);
    const json = res.ok ? await res.json() : { claims: [] };
    setClaims(json.claims ?? []);
  }

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/matching/claims?programId=${programId}`)
      .then((res) => (res.ok ? res.json() : { claims: [] }))
      .then((json: { claims?: ClaimWithNames[] }) => {
        if (!cancelled) setClaims(json.claims ?? []);
      })
      .catch(() => {
        if (!cancelled) setClaims([]);
      });
    return () => {
      cancelled = true;
    };
  }, [programId]);

  async function act(id: string, status: string) {
    setBusyId(id);
    try {
      await fetch(`/api/matching/claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  if (claims === null) return <p style={{ fontSize: 13, color: 'var(--t4)', padding: '8px 0' }}>Loading claims…</p>;
  if (claims.length === 0) return <p style={{ fontSize: 13, color: 'var(--t4)', padding: '8px 0' }}>No claims yet.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
      {claims.map((c) => (
        <div
          key={c.id}
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
              {c.employee_name || c.employee_email || 'Employee'} · donated{' '}
              {formatMoneyShort(c.donation_amount_cents, currency)} → match{' '}
              {formatMoneyShort(c.match_amount_cents, currency)}{' '}
              <Badge color={CLAIM_STATUS_COLOR[c.status] ?? 'gray'}>{c.status}</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {c.status === 'pending' && (
              <>
                <Btn size="sm" disabled={busyId === c.id} onClick={() => act(c.id, 'approved')}>Approve</Btn>
                <Btn size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => act(c.id, 'declined')}>Decline</Btn>
              </>
            )}
            {c.status === 'approved' && (
              <Btn size="sm" variant="secondary" disabled={busyId === c.id} onClick={() => act(c.id, 'paid')}>Mark paid</Btn>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ManageMatching({ initialPrograms }: { initialPrograms: ProgramWithSponsor[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/matching/programs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div>
      <CreateForm onCreated={() => router.refresh()} />

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Your programs</h2>
      {initialPrograms.length === 0 ? (
        <EmptyState icon="🏢" title="No programs yet" body="Launch your first matching program above to start receiving employee claims." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {initialPrograms.map((p) => (
            <div key={p.id} style={{ border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{p.company_name}</h3>
                    <Badge color={p.status === 'active' ? 'green' : 'gray'}>{p.status}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t4)', marginTop: 4 }}>
                    {p.match_ratio}:1 · {p.annual_cap_cents > 0 ? `${formatMoneyShort(p.annual_cap_cents, p.currency)}/yr cap` : 'uncapped'}
                    {p.categories.length > 0 ? ` · ${p.categories.join(', ')}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Btn size="sm" variant="ghost" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    {expanded === p.id ? 'Hide claims' : 'View claims'}
                  </Btn>
                  {p.status === 'active' ? (
                    <Btn size="sm" variant="ghost" onClick={() => setStatus(p.id, 'paused')}>Pause</Btn>
                  ) : p.status === 'paused' ? (
                    <Btn size="sm" variant="ghost" onClick={() => setStatus(p.id, 'active')}>Resume</Btn>
                  ) : null}
                </div>
              </div>
              {expanded === p.id && <ClaimsList programId={p.id} currency={p.currency} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
