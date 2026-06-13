'use client';

import React, { useMemo, useState } from 'react';

export interface LeadRow {
  id: string;
  business_name: string;
  entity_type: string | null;
  state: string | null;
  filing_date: string | null;
  filing_status: string | null;
  registered_agent: string | null;
  owner_name: string | null;
  industry: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  enrichment_notes: string | null;
  enrichment_model: string | null;
  enriched_at: string | null;
  lead_score: number;
  lead_grade: string | null;
  status: string;
  alerted: boolean;
  source: string;
  created_at: string;
}

interface Stats {
  total: number;
  new: number;
  enriched: number;
  hot: number;
  contacted: number;
}

const STATUS_OPTIONS = ['new', 'enriched', 'contacted', 'qualified', 'converted', 'rejected'] as const;

const STATUS_COLOR: Record<string, string> = {
  new: '#6c35ff',
  enriched: '#0ea5e9',
  contacted: '#f59e0b',
  qualified: '#8b5cf6',
  converted: '#19b86a',
  rejected: '#94a3b8',
};

function gradeColor(grade: string | null): string {
  switch (grade) {
    case 'A': return '#19b86a';
    case 'B': return '#0ea5e9';
    case 'C': return '#f59e0b';
    default: return '#94a3b8';
  }
}

const PIPELINE_STEPS = [
  { icon: '📄', label: 'New LLC filed' },
  { icon: '🗄️', label: 'Stored in Supabase' },
  { icon: '🌐', label: 'AI finds website' },
  { icon: '✉️', label: 'AI finds email' },
  { icon: '📞', label: 'AI finds phone' },
  { icon: '🎯', label: 'Score lead' },
  { icon: '🔔', label: 'Alert admin' },
];

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '16px 20px',
};

// Local YYYY-MM-DD (not UTC) so the date pickers default to "today" for the
// admin's own timezone, matching the "new filings from today" expectation.
function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function NewCustomersClient({ initialLeads, stats }: { initialLeads: LeadRow[]; stats: Stats }) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [ingesting, setIngesting] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [minScore, setMinScore] = useState(0);
  const [search, setSearch] = useState('');

  // OpenCorporates connector — date range defaults to today (new filings only)
  const [ocQuery, setOcQuery] = useState('');
  const [ocDateFrom, setOcDateFrom] = useState(() => todayISO());
  const [ocDateTo, setOcDateTo] = useState(() => todayISO());

  // API self-test
  const [testResult, setTestResult] = useState<{ ok: boolean; checks: { name: string; ok: boolean; detail: string }[] } | null>(null);
  const [testing, setTesting] = useState(false);

  const flash = (text: string, tone: 'ok' | 'err') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 4000);
  };

  const states = useMemo(
    () => [...new Set(leads.map((l) => l.state).filter(Boolean))].sort() as string[],
    [leads],
  );

  const filtered = useMemo(() => leads.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (stateFilter !== 'all' && l.state !== stateFilter) return false;
    if (l.lead_score < minScore) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!l.business_name.toLowerCase().includes(q) && !(l.owner_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [leads, statusFilter, stateFilter, minScore, search]);

  async function ingest(mode: 'sample' | 'opencorporates') {
    setIngesting(true);
    try {
      const body = mode === 'sample'
        ? { mode: 'sample', count: 8 }
        : {
          mode: 'opencorporates',
          ...(ocQuery.trim().length >= 2 ? { query: ocQuery.trim() } : {}),
          ...(ocDateFrom ? { date_from: ocDateFrom } : {}),
          ...(ocDateTo ? { date_to: ocDateTo } : {}),
        };
      const res = await fetch('/api/admin/new-customers/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { flash(json.error ?? 'Ingest failed.', 'err'); return; }
      flash(json.message ?? `Stored ${json.inserted} filings.`, 'ok');
      if (json.inserted > 0) setTimeout(() => window.location.reload(), 1200);
    } catch {
      flash('Ingest failed — please try again.', 'err');
    } finally {
      setIngesting(false);
    }
  }

  async function enrich(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/admin/new-customers/${id}/enrich`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { flash(json.error ?? 'Enrichment failed.', 'err'); return; }
      setLeads((prev) => prev.map((l) => l.id === id ? {
        ...l,
        website: json.website, email: json.email, phone: json.phone,
        enrichment_notes: json.notes, enrichment_model: json.model,
        enriched_at: new Date().toISOString(),
        lead_score: json.score, lead_grade: json.grade,
        status: l.status === 'new' ? 'enriched' : l.status,
        alerted: l.alerted || json.alerted,
      } : l));
      flash(
        `Enriched "${leads.find((l) => l.id === id)?.business_name}" — scored ${json.score}/100 (grade ${json.grade})${json.alerted ? ' · admin alerted 🔔' : ''}`,
        'ok',
      );
    } catch {
      flash('Enrichment failed — please try again.', 'err');
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function changeStatus(id: string, status: string) {
    const prev = leads.find((l) => l.id === id)?.status;
    setLeads((p) => p.map((l) => l.id === id ? { ...l, status } : l));
    try {
      const res = await fetch(`/api/admin/new-customers/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setLeads((p) => p.map((l) => l.id === id ? { ...l, status: prev ?? 'new' } : l));
        flash('Could not update status.', 'err');
      }
    } catch {
      setLeads((p) => p.map((l) => l.id === id ? { ...l, status: prev ?? 'new' } : l));
      flash('Could not update status.', 'err');
    }
  }

  async function runSelfTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/new-customers/test');
      const json = await res.json();
      setTestResult({ ok: !!json.ok, checks: json.checks ?? [] });
    } catch {
      setTestResult({ ok: false, checks: [{ name: 'request', ok: false, detail: 'Could not reach the test endpoint.' }] });
    } finally {
      setTesting(false);
    }
  }

  const statItems = [
    { label: 'Total leads', value: stats.total, color: '#1a1a2e' },
    { label: 'New', value: stats.new, color: '#6c35ff' },
    { label: 'AI-enriched', value: stats.enriched, color: '#0ea5e9' },
    { label: 'Hot (60+)', value: stats.hot, color: '#19b86a' },
    { label: 'In outreach', value: stats.contacted, color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: '24px 32px', display: 'grid', gap: 20 }}>

      {/* Pipeline flow */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#64748b', marginBottom: 12 }}>LEAD PIPELINE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {PIPELINE_STEPS.map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 78 }}>
                <span style={{ fontSize: 22 }}>{step.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#334064', textAlign: 'center', lineHeight: 1.3 }}>{step.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && <span style={{ color: '#cbd5e1', fontSize: 18, fontWeight: 900 }}>→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14 }}>
        {statItems.map((s) => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void ingest('sample')}
          disabled={ingesting}
          style={btnPrimary(ingesting)}
        >
          {ingesting ? 'Working…' : '＋ Add sample filings'}
        </button>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={ocQuery}
            onChange={(e) => setOcQuery(e.target.value)}
            placeholder="Search OpenCorporates (optional)…"
            style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, width: 200 }}
          />
          <input
            type="date"
            value={ocDateFrom}
            max={ocDateTo}
            onChange={(e) => setOcDateFrom(e.target.value)}
            aria-label="Filed from"
            style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13 }}
          />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>to</span>
          <input
            type="date"
            value={ocDateTo}
            min={ocDateFrom}
            onChange={(e) => setOcDateTo(e.target.value)}
            aria-label="Filed to"
            style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13 }}
          />
          <button
            type="button"
            onClick={() => void ingest('opencorporates')}
            disabled={ingesting}
            style={btnSecondary(ingesting)}
          >
            Pull
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <button type="button" onClick={() => void runSelfTest()} disabled={testing} style={btnGhost(testing)}>
          {testing ? 'Testing…' : '🧪 Run API self-test'}
        </button>
      </div>

      {/* Self-test result */}
      {testResult && (
        <div style={{ ...card, borderColor: testResult.ok ? '#bbf7d0' : '#fecdd3', background: testResult.ok ? '#f0fff4' : '#fff0f3' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: testResult.ok ? '#15803d' : '#be123c', marginBottom: 10 }}>
            {testResult.ok ? '✅ All API checks passed' : '❌ Some API checks failed'}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {testResult.checks.map((c) => (
              <div key={c.name} style={{ display: 'flex', gap: 8, fontSize: 12.5, fontFamily: 'monospace' }}>
                <span>{c.ok ? '✓' : '✗'}</span>
                <strong style={{ minWidth: 180 }}>{c.name}</strong>
                <span style={{ color: '#64748b' }}>{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or owner…"
          style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, flex: '1 1 220px' }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={selectStyle}>
          <option value="all">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} style={selectStyle}>
          <option value={0}>Any score</option>
          <option value={40}>Score ≥ 40</option>
          <option value={60}>Score ≥ 60</option>
          <option value={80}>Score ≥ 80</option>
        </select>
        <span style={{ fontSize: 13, color: '#64748b' }}>{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
            {leads.length === 0
              ? 'No business leads yet. Click "Add sample filings" or pull from OpenCorporates to populate the pipeline.'
              : 'No leads match your filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Business', 'Filing', 'Score', 'Contact info', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined, verticalAlign: 'top' }}>
                    {/* Business */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {l.business_name}
                        {l.alerted && <span title="Admin alerted">🔔</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                        {[l.entity_type, l.state, l.industry].filter(Boolean).join(' · ') || '—'}
                      </div>
                      {l.owner_name && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Owner: {l.owner_name}</div>}
                    </td>

                    {/* Filing */}
                    <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      <div>{l.filing_date ?? '—'}</div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{l.filing_status ?? l.source}</div>
                    </td>

                    {/* Score */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ background: gradeColor(l.lead_grade) + '18', color: gradeColor(l.lead_grade), padding: '3px 10px', borderRadius: 20, fontWeight: 800, fontSize: 12.5 }}>
                          {l.lead_score}
                        </span>
                        {l.lead_grade && <strong style={{ color: gradeColor(l.lead_grade), fontSize: 12 }}>{l.lead_grade}</strong>}
                      </span>
                    </td>

                    {/* Contact */}
                    <td style={{ padding: '12px 16px', minWidth: 190 }}>
                      {l.enriched_at ? (
                        <div style={{ display: 'grid', gap: 2, fontSize: 12.5 }}>
                          {l.website ? <a href={l.website} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', textDecoration: 'none' }}>🌐 {l.website.replace(/^https?:\/\//, '')}</a> : <span style={{ color: '#cbd5e1' }}>🌐 —</span>}
                          {l.email ? <a href={`mailto:${l.email}`} style={{ color: '#6c35ff', textDecoration: 'none' }}>✉️ {l.email}</a> : <span style={{ color: '#cbd5e1' }}>✉️ —</span>}
                          {l.phone ? <span style={{ color: '#334064' }}>📞 {l.phone}</span> : <span style={{ color: '#cbd5e1' }}>📞 —</span>}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Not enriched yet</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={l.status}
                        onChange={(e) => void changeStatus(l.id, e.target.value)}
                        style={{
                          padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          border: `1px solid ${STATUS_COLOR[l.status] ?? '#cbd5e1'}40`,
                          background: (STATUS_COLOR[l.status] ?? '#94a3b8') + '14',
                          color: STATUS_COLOR[l.status] ?? '#64748b',
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => void enrich(l.id)}
                        disabled={busy[l.id]}
                        style={{
                          fontSize: 12, padding: '6px 12px', borderRadius: 8, fontWeight: 700,
                          border: 'none', cursor: busy[l.id] ? 'default' : 'pointer',
                          background: 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', opacity: busy[l.id] ? 0.6 : 1,
                        }}
                      >
                        {busy[l.id] ? 'Enriching…' : l.enriched_at ? '↻ Re-enrich' : '✨ Enrich'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          padding: '12px 22px', borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: '#fff',
          background: toast.tone === 'ok' ? 'linear-gradient(135deg,#19b86a,#0f9454)' : 'linear-gradient(135deg,#ef4444,#be123c)',
          boxShadow: '0 8px 32px rgba(0,0,0,.2)', maxWidth: 520,
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13,
  background: '#fff', color: '#334064', cursor: 'pointer',
};

function btnPrimary(disabled: boolean): React.CSSProperties {
  return { padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: disabled ? 'default' : 'pointer', background: 'linear-gradient(135deg,#19b86a,#0f9454)', color: '#fff', opacity: disabled ? 0.6 : 1 };
}
function btnSecondary(disabled: boolean): React.CSSProperties {
  return { padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: disabled ? 'default' : 'pointer', background: '#6c35ff', color: '#fff', opacity: disabled ? 0.5 : 1 };
}
function btnGhost(disabled: boolean): React.CSSProperties {
  return { padding: '9px 16px', borderRadius: 10, border: '1px solid #e2e8f0', fontWeight: 800, fontSize: 13, cursor: disabled ? 'default' : 'pointer', background: '#fff', color: '#334064', opacity: disabled ? 0.6 : 1 };
}
