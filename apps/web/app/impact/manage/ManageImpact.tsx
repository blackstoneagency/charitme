'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Btn, Input, Textarea, Select, Badge } from '../../../components/ui';
import type { ImpactBundle } from '../../../lib/impact';

type Campaign = { id: string; slug: string; title: string };
type ItemDraft = { label: string; planned: string; spent: string };

export default function ManageImpact({
  campaigns,
  selectedId,
  bundle,
}: {
  campaigns: Campaign[];
  selectedId: string | null;
  bundle: ImpactBundle | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Plan editor state seeded from the existing plan.
  const [planTitle, setPlanTitle] = useState(bundle?.plan?.title ?? 'Impact Plan');
  const [planSummary, setPlanSummary] = useState(bundle?.plan?.summary ?? '');
  const [items, setItems] = useState<ItemDraft[]>(
    bundle?.plan?.items.length
      ? bundle.plan.items.map((i) => ({ label: i.label, planned: String(i.planned_amount_cents / 100), spent: String(i.spent_amount_cents / 100) }))
      : [{ label: '', planned: '', spent: '' }],
  );

  // Update composer.
  const [updTitle, setUpdTitle] = useState('');
  const [updBody, setUpdBody] = useState('');
  const [updSpent, setUpdSpent] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  // Metric composer.
  const [metricLabel, setMetricLabel] = useState('');
  const [metricUnit, setMetricUnit] = useState('');
  const [metricTarget, setMetricTarget] = useState('');
  const [metricCurrent, setMetricCurrent] = useState('');

  if (campaigns.length === 0) {
    return (
      <p style={{ fontSize: 15, color: 'var(--t3)' }}>
        You don’t have any campaigns yet. <Link href="/create/choose-path" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>Start one →</Link>
      </p>
    );
  }

  async function call(url: string, method: string, body: unknown, ok: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error ?? 'Something went wrong.');
        return false;
      }
      setMsg(ok);
      router.refresh();
      return true;
    } catch {
      setErr('Network error. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const cents = (v: string) => Math.round(Number(v || 0) * 100);

  async function savePlan(status: 'draft' | 'published') {
    if (!selectedId) return;
    await call('/api/impact/plans', 'POST', {
      campaign_id: selectedId,
      title: planTitle,
      summary: planSummary || null,
      status,
      items: items
        .filter((i) => i.label.trim())
        .map((i) => ({ label: i.label.trim(), planned_amount_cents: cents(i.planned), spent_amount_cents: cents(i.spent) })),
    }, status === 'published' ? 'Plan published.' : 'Plan saved as draft.');
  }

  async function postUpdate() {
    if (!selectedId || updTitle.trim().length < 2 || updBody.trim().length < 1) {
      setErr('Add a title and body for the update.');
      return;
    }
    const ok = await call('/api/impact/updates', 'POST', {
      campaign_id: selectedId,
      title: updTitle,
      body: updBody,
      amount_spent_cents: updSpent ? cents(updSpent) : null,
      status: 'published',
      evidence: evidenceUrl ? [{ kind: 'link', url: evidenceUrl }] : [],
    }, 'Update published.');
    if (ok) { setUpdTitle(''); setUpdBody(''); setUpdSpent(''); setEvidenceUrl(''); }
  }

  async function addMetric() {
    if (!selectedId || !metricLabel.trim()) {
      setErr('Add a metric label.');
      return;
    }
    const ok = await call('/api/impact/metrics', 'POST', {
      campaign_id: selectedId,
      label: metricLabel,
      unit: metricUnit || null,
      target_value: metricTarget ? Number(metricTarget) : null,
      current_value: metricCurrent ? Number(metricCurrent) : 0,
    }, 'Metric added.');
    if (ok) { setMetricLabel(''); setMetricUnit(''); setMetricTarget(''); setMetricCurrent(''); }
  }

  const card: React.CSSProperties = { border: '1px solid var(--b2)', borderRadius: 'var(--rl)', padding: 20, marginBottom: 24 };

  return (
    <div>
      <div style={{ display: 'flex', minWidth: 0, gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <Select
          label="Campaign"
          value={selectedId ?? ''}
          onChange={(e) => router.push(`/impact/manage?campaign=${e.target.value}`)}
          style={{ maxWidth: 360 }}
        >
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
        {bundle && (
          <div style={{ marginTop: 18 }}>
            <Badge color="green">Transparency {bundle.transparency.score}/100 · {bundle.transparency.rating}</Badge>{' '}
            {bundle.campaign.slug && <Link href={`/impact/${bundle.campaign.slug}`} style={{ fontSize: 13, color: 'var(--green-dark)', fontWeight: 600 }}>View public page →</Link>}
          </div>
        )}
      </div>

      {msg && <div style={{ background: 'var(--green-light)', color: 'var(--green-dark)', padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 14, marginBottom: 16 }}>{msg}</div>}
      {err && <div style={{ background: 'var(--s3)', color: 'var(--red-text)', padding: '10px 14px', borderRadius: 'var(--r)', fontSize: 14, marginBottom: 16 }}>{err}</div>}

      {/* Spending plan */}
      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Spending plan {bundle?.plan && <Badge color={bundle.plan.status === 'published' ? 'green' : 'gray'}>{bundle.plan.status}</Badge>}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input label="Plan title" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} />
          <Textarea label="Summary" value={planSummary} onChange={(e) => setPlanSummary(e.target.value)} rows={2} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>Budget line items (USD)</div>
          {items.map((it, idx) => (
            <div key={idx} className="impact-budget-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 120px) minmax(0, 120px) auto', gap: 8, alignItems: 'center' }}>
              <Input placeholder="Label (e.g. Medical supplies)" value={it.label} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
              <Input type="number" min={0} step="0.01" placeholder="Planned" value={it.planned} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, planned: e.target.value } : x))} />
              <Input type="number" min={0} step="0.01" placeholder="Spent" value={it.spent} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, spent: e.target.value } : x))} />
              <Btn size="sm" variant="ghost" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>✕</Btn>
            </div>
          ))}
          <div>
            <Btn size="sm" variant="ghost" onClick={() => setItems((p) => [...p, { label: '', planned: '', spent: '' }])}>+ Add line item</Btn>
          </div>
          <div style={{ display: 'flex', minWidth: 0, gap: 10 }}>
            <Btn disabled={busy} onClick={() => savePlan('published')}>Publish plan</Btn>
            <Btn disabled={busy} variant="ghost" onClick={() => savePlan('draft')}>Save draft</Btn>
          </div>
        </div>
      </div>

      {/* Post an update */}
      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Post an impact update</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input label="Title" value={updTitle} onChange={(e) => setUpdTitle(e.target.value)} />
          <Textarea label="What happened" value={updBody} onChange={(e) => setUpdBody(e.target.value)} rows={3} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input label="Amount spent (USD, optional)" type="number" min={0} step="0.01" value={updSpent} onChange={(e) => setUpdSpent(e.target.value)} />
            <Input label="Evidence link (receipt/photo URL, optional)" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div><Btn disabled={busy} onClick={postUpdate}>Publish update</Btn></div>
        </div>
      </div>

      {/* Add a metric */}
      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Outcome metrics</h2>
        {bundle && bundle.metrics.length > 0 && (
          <div style={{ display: 'flex', minWidth: 0, gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {bundle.metrics.map((m) => (
              <span key={m.id} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 999, background: 'var(--s3)', color: 'var(--t2)' }}>
                {m.label}: {m.current_value.toLocaleString()}{m.target_value ? `/${m.target_value.toLocaleString()}` : ''}{m.unit ? ` ${m.unit}` : ''}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
          <Input label="Metric" value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} placeholder="Meals served" />
          <Input label="Unit" value={metricUnit} onChange={(e) => setMetricUnit(e.target.value)} placeholder="meals" />
          <Input label="Target" type="number" min={0} value={metricTarget} onChange={(e) => setMetricTarget(e.target.value)} />
          <Input label="Current" type="number" min={0} value={metricCurrent} onChange={(e) => setMetricCurrent(e.target.value)} />
          <Btn disabled={busy} onClick={addMetric}>Add</Btn>
        </div>
      </div>
    </div>
  );
}
