'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface PayoutRecord {
  id: string;
  recipient_name: string;
  recipient_email: string;
  campaign_title: string;
  amount_cents: number;
  status: string;
  payout_method: string;
  note: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface WeekPoint {
  week: string;
  total_cents: number;
}

export interface TopRecipient {
  id: string;
  name: string;
  total_cents: number;
}

export interface PayoutsClientProps {
  totalCents: number;
  pendingCents: number;
  completedCents: number;
  failedCount: number;
  pendingCount: number;
  completedCount: number;
  payouts: PayoutRecord[];
  weeklyTrend: WeekPoint[];
  topRecipients: TopRecipient[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtCents(cents: number): string {
  const d = cents / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${d.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `$${d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

// ─────────────────────────────────────────────
// SVG line chart
// ─────────────────────────────────────────────
function TrendChart({ points }: { points: WeekPoint[] }) {
  if (points.length < 2) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#8c9ab5', fontSize: 14 }}>Not enough data</div>;
  const W = 480; const H = 180; const pad = 16;
  const max = Math.max(...points.map(p => p.total_cents), 1);
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map(p => pad + (1 - p.total_cents / max) * (H - pad * 2));
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaD = `${pathD} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
      <defs><linearGradient id="payGrad" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#ec3fb4" stopOpacity="0.15"/><stop offset="1" stopColor="#ec3fb4" stopOpacity="0"/></linearGradient></defs>
      <path d={areaD} fill="url(#payGrad)" />
      <path d={pathD} fill="none" stroke="#ec3fb4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="4" fill="#ec3fb4" stroke="#fff" strokeWidth="3" />)}
      {points.map((p, i) => <text key={i} x={xs[i]} y={H - 2} textAnchor="middle" fontSize="9" fill="#8c9ab5">{p.week.slice(5)}</text>)}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Status donut
// ─────────────────────────────────────────────
function StatusDonut({ pending, completed, failed, total }: { pending: number; completed: number; failed: number; total: number }) {
  const slices = [
    { label: 'Completed', value: completed, color: '#19b86a' },
    { label: 'Pending', value: pending, color: '#f97316' },
    { label: 'Failed', value: failed, color: 'var(--red-text)' },
  ].filter(s => s.value > 0);
  const t = Math.max(slices.reduce((s, x) => s + x.value, 0), 1);
  const r = 56; const cx = 72; const cy = 72; const circ = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg viewBox="0 0 144 144" style={{ width: 110, height: 110, flexShrink: 0 }}>
        {slices.map((s, index) => {
          const frac = s.value / t;
          const dash = frac * circ;
          const o = slices.slice(0, index).reduce((sum, previous) => sum + (previous.value / t), 0);
          return <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="22" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-o * circ + circ / 4} />;
        })}
        <circle cx={cx} cy={cy} r={r - 11} fill="#fff" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="950" fill="#101944">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#8c9ab5">Total</text>
      </svg>
      <div style={{ display: 'grid', gap: 10 }}>
        {slices.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#26335c' }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0, display: 'block' }} />
            <span>{s.label}</span>
            <b style={{ marginLeft: 'auto', color: '#0f0f30' }}>{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Status pill
// ─────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone = s.includes('paid') || s.includes('completed') ? 'green'
    : s.includes('pending') || s.includes('requested') || s.includes('approved') ? 'orange'
    : s.includes('failed') || s.includes('rejected') ? 'red'
    : s.includes('cancelled') ? 'violet'
    : 'violet';
  return <span className={`kf-pill ${tone}`}>{capitalize(status)}</span>;
}

// ─────────────────────────────────────────────
// Payout detail panel
// ─────────────────────────────────────────────
function PayoutDetailPanel({ payout, onClose }: { payout: PayoutRecord; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('info');
  const [actionMode, setActionMode] = useState('approve');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEscape(onClose);

  async function handleAction() {
    setSaving(true);
    try {
      await fetch(`/api/admin/payouts/${payout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionMode, note }),
      });
      onClose();
    } catch {
      // silently handle
    } finally {
      setSaving(false);
    }
  }

  return (
    // Backdrop dismissal is supplementary; Escape and the close button remain available.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ marginLeft: 'auto', width: 500, maxWidth: '100vw', background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-12px 0 56px rgba(20,20,80,.14)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f0f30' }}>{payout.recipient_name}</div>
            <div style={{ fontSize: 13, color: '#66708d', marginTop: 2 }}>{payout.recipient_email || 'No email'}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
              <StatusPill status={payout.status} />
              <span style={{ fontSize: 11, color: '#8c9ab5', display: 'inline-flex', alignItems: 'center' }}>ID: {payout.id.slice(0, 12)}…</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid #eef0f7', background: '#fbf9ff' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#101944', letterSpacing: '-.03em' }}>{fmtCents(payout.amount_cents)}</div>
          <div style={{ fontSize: 13, color: '#66708d', marginTop: 4 }}>Requested {fmtDate(payout.created_at)}</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #eef0f7', padding: '0 24px' }}>
          {['info', 'history', 'action'].map(t => (
            <button key={t} type="button" onClick={() => setActiveTab(t)}
              style={{ height: 44, border: 0, borderBottom: `2px solid ${activeTab === t ? '#6c35ff' : 'transparent'}`, background: 'none', fontWeight: activeTab === t ? 950 : 750, fontSize: 13, color: activeTab === t ? '#551cf2' : '#66708d', marginRight: 20, cursor: 'pointer' }}>
              {capitalize(t)}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 24px', flex: 1 }}>
          {activeTab === 'info' && (
            <div style={{ display: 'grid', gap: 2 }}>
              {[
                ['Campaign', payout.campaign_title],
                ['Amount', fmtCents(payout.amount_cents)],
                ['Status', capitalize(payout.status)],
                ['Payout Method', payout.payout_method],
                ['Requested On', fmtDate(payout.created_at)],
                ['Payout Date', payout.paid_at ? fmtDate(payout.paid_at) : '—'],
                ['Reference Note', payout.note || '—'],
                ['Transaction Fee', fmtCents(Math.round(payout.amount_cents * 0.025))],
                ['Net Amount', fmtCents(Math.round(payout.amount_cents * 0.975))],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <span style={{ color: '#66708d', fontWeight: 700 }}>{label}</span>
                  <span style={{ color: '#101944', fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { event: 'Payout requested', date: payout.created_at, color: '#6c35ff' },
                payout.paid_at ? { event: 'Payout completed', date: payout.paid_at, color: '#19b86a' } : null,
              ].filter(Boolean).map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: (ev as { color: string }).color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#101944' }}>{(ev as { event: string }).event}</div>
                    <div style={{ fontSize: 12, color: '#8c9ab5', marginTop: 2 }}>{fmtDate((ev as { date: string }).date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'action' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#66708d', fontWeight: 700 }}>Current Status:</span>
                <StatusPill status={payout.status} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#101944' }}>Select Action</div>
              {[
                { value: 'approve', label: 'Approve Payout', desc: 'Approve and initiate the payout' },
                { value: 'mark_paid', label: 'Mark as Paid', desc: 'Mark as paid manually' },
                { value: 'reject', label: 'Reject Payout', desc: 'Reject this payout request' },
                { value: 'cancel', label: 'Cancel Payout', desc: 'Cancel without processing' },
              ].map(a => (
                <label key={a.value} style={{ display: 'flex', gap: 10, cursor: 'pointer', padding: '12px', border: `1px solid ${actionMode === a.value ? '#6c35ff' : '#e6e9f2'}`, borderRadius: 10, background: actionMode === a.value ? '#f3ecff' : '#fff' }}>
                  <input type="radio" name="action" value={a.value} checked={actionMode === a.value} onChange={e => setActionMode(e.target.value)} aria-label={a.label} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: '#101944' }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: '#66708d', marginTop: 2 }}>{a.desc}</div>
                  </div>
                </label>
              ))}
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Add Note
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note…" style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={onClose} style={{ flex: 1, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={handleAction} disabled={saving} style={{ flex: 1, height: 42, border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Confirm Action'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
type AuditEntry = { id: string; action: string; actorName: string; metadata: Record<string, unknown>; createdAt: string };

function exportCsv(rows: PayoutRecord[]) {
  const header = ['Recipient', 'Email', 'Campaign', 'Amount_USD', 'Status', 'Method', 'Date'].join(',');
  const lines = rows.map(p => [
    p.recipient_name, p.recipient_email, p.campaign_title,
    (p.amount_cents / 100).toFixed(2), p.status, p.payout_method,
    new Date(p.created_at).toISOString(),
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `payouts-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function PayoutsClient({
  totalCents, pendingCents, completedCents, failedCount, pendingCount, completedCount,
  payouts, weeklyTrend, topRecipients,
}: PayoutsClientProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PayoutRecord | null>(null);
  const [activeTab, setActiveTab] = useState('payouts');

  // ── Add payout form state
  const [addUserId, setAddUserId] = useState('');
  const [addCampaignId, setAddCampaignId] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addMethod, setAddMethod] = useState('Bank Transfer');
  const [addNote, setAddNote] = useState('');
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // ── Audit log state
  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const PAGE_SIZE = 10;
  const totalCount = pendingCount + completedCount + failedCount;

  const filtered = useMemo(() => {
    let list = payouts;
    if (filterStatus !== 'all') list = list.filter(p => p.status.toLowerCase().includes(filterStatus));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.recipient_name.toLowerCase().includes(q) || p.campaign_title.toLowerCase().includes(q));
    }
    return list;
  }, [payouts, filterStatus, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const panelTabs = ['payouts', 'recurring', 'add', 'methods', 'reports', 'export', 'audit'];

  const loadAuditLog = useCallback(async () => {
    if (auditEntries !== null) return; // already loaded
    setAuditLoading(true);
    try {
      const res = await fetch('/api/admin/audit?target_type=payout&limit=30');
      if (res.ok) setAuditEntries(await res.json() as AuditEntry[]);
    } finally { setAuditLoading(false); }
  }, [auditEntries]);

  function handleTabChange(t: string) {
    setActiveTab(t);
    if (t === 'audit') loadAuditLog();
  }

  async function handleCreatePayout() {
    setAddError('');
    const amountCents = Math.round(parseFloat(addAmount.replace(/,/g, '')) * 100);
    if (!addUserId.trim()) { setAddError('Recipient User ID is required.'); return; }
    if (!amountCents || amountCents < 1) { setAddError('Enter a valid amount greater than $0.'); return; }
    setAddSaving(true);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: addUserId.trim(), campaign_id: addCampaignId.trim() || undefined, amount_cents: amountCents, payout_method: addMethod, note: addNote.trim() || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setAddError(data.error ?? 'Failed to create payout.'); return; }
      setAddSuccess(true);
      setAddUserId(''); setAddCampaignId(''); setAddAmount(''); setAddNote('');
      // Reset audit cache so next view is fresh
      setAuditEntries(null);
      setTimeout(() => setAddSuccess(false), 5000);
    } catch {
      setAddError('Network error. Please try again.');
    } finally { setAddSaving(false); }
  }

  return (
    <div style={{ padding: '0 32px 40px' }}>
      {/* KPI */}
      <div className="kf-metrics" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Paid Out', value: fmtCents(totalCents), tone: 'violet', icon: 'wallet' },
          { label: 'Pending', value: fmtCents(pendingCents), tone: 'orange', icon: 'audit' },
          { label: 'Completed', value: fmtCents(completedCents), tone: 'green', icon: 'check' },
          { label: 'Failed', value: failedCount.toLocaleString(), tone: 'pink', icon: 'doc' },
        ].map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22} strokeLinecap="round" strokeLinejoin="round">
                {m.icon === 'wallet' && <><path d="M20 7H5a3 3 0 0 1 0-6h12v6"/><path d="M4 7v13a2 2 0 0 0 2 2h14V7"/><path d="M16 14h.01"/></>}
                {m.icon === 'audit' && <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>}
                {m.icon === 'check' && <path d="M20 6L9 17l-5-5"/>}
                {m.icon === 'doc' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></>}
              </svg>
            </div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          </article>
        ))}
      </div>

      {/* Charts */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card kf-chart">
          <div className="kf-card-head"><h2>Payouts Over Time</h2><span style={{ fontSize: 12, color: '#8c9ab5' }}>Last 8 weeks</span></div>
          <div style={{ padding: '0 18px 12px' }}><TrendChart points={weeklyTrend} /></div>
        </section>

        <section className="kf-card">
          <div className="kf-card-head"><h2>By Status</h2></div>
          <div style={{ padding: '10px 20px 20px' }}>
            <StatusDonut pending={pendingCount} completed={completedCount} failed={failedCount} total={totalCount} />
          </div>

          {/* Top Recipients */}
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f0f2f8', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#101944', marginBottom: 12 }}>Top Recipients</div>
            {topRecipients.slice(0, 3).map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f2f8' }}>
                <span style={{ width: 22, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#6c35ff' }}>#{i + 1}</span>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <strong style={{ fontSize: 13, color: '#101944' }}>{fmtCents(r.total_cents)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent payouts */}
      <section className="kf-card" style={{ marginBottom: 24 }}>
        <div className="kf-card-head"><h2>Recent Payouts</h2></div>
        {payouts.slice(0, 5).map(p => (
          <div key={p.id} role="button" tabIndex={0} aria-label={`View payout for ${p.recipient_name}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer' }}
            onClick={() => setSelected(p)}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(p); } }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#fdeaf6,#ec3fb4)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {p.recipient_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: '#101944' }}>{p.recipient_name}</div>
              <div style={{ fontSize: 11, color: '#66708d' }}>{p.campaign_title}</div>
            </div>
            <StatusPill status={p.status} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#101944' }}>{fmtCents(p.amount_cents)}</div>
              <div style={{ fontSize: 11, color: '#8c9ab5' }}>{fmtDate(p.created_at)}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Main table */}
      <section className="kf-card">
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #eef0f7', padding: '0 20px', overflowX: 'auto' }}>
          {panelTabs.map(t => (
            <button key={t} type="button" onClick={() => handleTabChange(t)}
              style={{ height: 50, padding: '0 14px', border: 0, borderBottom: `2px solid ${activeTab === t ? '#6c35ff' : 'transparent'}`, background: 'none', fontWeight: activeTab === t ? 950 : 750, fontSize: 13, color: activeTab === t ? '#551cf2' : '#202b55', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {capitalize(t)}
            </button>
          ))}
        </div>

        {activeTab === 'payouts' && (
          <div>
            <div style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid #eef0f7', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', background: '#fff' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#8c9ab5" strokeWidth={2} width={15} height={15} aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search payouts…" aria-label="Search payouts" style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, width: '100%' }} />
              </div>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} style={{ height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', fontSize: 13, background: '#fff' }}>
                <option value="all">All Status</option>
                <option value="paid">Completed</option>
                <option value="pending">Pending</option>
                <option value="requested">Requested</option>
                <option value="failed">Failed</option>
              </select>
              <button type="button" style={{ height: 42, padding: '0 18px', border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => exportCsv(filtered)}>Export CSV</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 130px', gap: 12, padding: '10px 20px', background: '#f8f9fc', borderBottom: '1px solid #eef0f7', fontSize: 11, fontWeight: 700, color: '#8c9ab5', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Recipient</span>
              <span>Campaign</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Date</span>
            </div>

            {currentPage.map(p => (
              <div key={p.id}
                role="button" tabIndex={0} aria-label={`View payout for ${p.recipient_name}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 130px', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer', alignItems: 'center' }}
                onClick={() => setSelected(p)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(p); } }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#fdeaf6,#ec3fb4)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {p.recipient_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: '#101944' }}>{p.recipient_name}</div>
                    {p.recipient_email && <div style={{ fontSize: 11, color: '#8c9ab5' }}>{p.recipient_email}</div>}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#26335c', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.campaign_title}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#101944' }}>{fmtCents(p.amount_cents)}</div>
                <StatusPill status={p.status} />
                <div style={{ fontSize: 12, color: '#8c9ab5' }}>{fmtDate(p.created_at)}</div>
              </div>
            ))}

            {currentPage.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No payouts found</div>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #eef0f7' }}>
              <span style={{ fontSize: 13, color: '#66708d' }}>Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}>← Prev</button>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page >= pages - 1 ? 'default' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, fontSize: 13 }}>Next →</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recurring' && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
              {[{ label: 'Total Recurring', value: totalCount, color: '#6c35ff' }, { label: 'Active', value: completedCount, color: '#19b86a' }, { label: 'Paused', value: pendingCount, color: '#f97316' }, { label: 'Cancelled', value: 0, color: 'var(--red-text)' }].map(s => (
                <div key={s.label} style={{ padding: '18px', border: '1px solid #e6e9f2', borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: '#66708d', fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#8c9ab5', fontSize: 14 }}>Recurring payout schedules will appear here.</p>
          </div>
        )}

        {activeTab === 'add' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Add Manual Payout</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#66708d' }}>Create a payout for an existing platform user. Find User IDs in Admin → Users.</p>
            {addSuccess && (
              <div style={{ padding: '12px 16px', borderRadius: 9, background: '#def7e7', color: '#079447', fontSize: 13, fontWeight: 650, marginBottom: 16 }}>
                ✓ Payout created successfully. Reload the page to see it in the list.
              </div>
            )}
            <div style={{ maxWidth: 460, display: 'grid', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Recipient User ID <span style={{ color: '#e11d48' }}>*</span>
                <input type="text" value={addUserId} onChange={e => setAddUserId(e.target.value)} placeholder="e.g. 12a3bc45-6d7e-..." style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Campaign ID (optional)
                <input type="text" value={addCampaignId} onChange={e => setAddCampaignId(e.target.value)} placeholder="Leave blank for unattached payout" style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Amount (USD) <span style={{ color: '#e11d48' }}>*</span>
                <input type="number" min="0.01" step="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="0.00" style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Payout Method
                <select value={addMethod} onChange={e => setAddMethod(e.target.value)} style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}>
                  <option>Bank Transfer</option>
                  <option>PayPal</option>
                  <option>Wise</option>
                  <option>Stripe Connect</option>
                  <option>Check</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#26335c' }}>
                Internal Note
                <textarea value={addNote} onChange={e => setAddNote(e.target.value)} placeholder="Reason for manual payout…" style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical' }} />
              </label>
              {addError && <p style={{ margin: 0, color: '#e11d48', fontSize: 13, fontWeight: 600 }}>{addError}</p>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => { setAddUserId(''); setAddCampaignId(''); setAddAmount(''); setAddNote(''); setAddError(''); setAddSuccess(false); }} style={{ flex: 1, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                <button type="button" onClick={handleCreatePayout} disabled={addSaving} style={{ flex: 1, height: 42, border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: addSaving ? 'default' : 'pointer', opacity: addSaving ? 0.65 : 1 }}>
                  {addSaving ? 'Creating…' : 'Create Payout'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'methods' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Payout Methods</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { name: 'Bank Transfer', isDefault: true },
                { name: 'PayPal', isDefault: false },
                { name: 'Wise', isDefault: false },
                { name: 'Stripe Connect', isDefault: false },
              ].map(m => (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', border: '1px solid #e6e9f2', borderRadius: 12 }}>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#101944' }}>{m.name}</div>
                  {m.isDefault && <span style={{ fontSize: 11, fontWeight: 700, color: '#551cf2', background: '#efe8ff', padding: '3px 10px', borderRadius: 999 }}>Default</span>}
                  <button type="button" style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Configure</button>
                </div>
              ))}
            </div>
            <button type="button" style={{ marginTop: 14, height: 42, padding: '0 20px', border: '1px dashed #d7c9ff', borderRadius: 9, background: '#fbf7ff', color: '#551cf2', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Method</button>
          </div>
        )}

        {activeTab === 'reports' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Payout Reports</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 13 }}><option>Payout Summary</option><option>Recipient Report</option><option>Fee Report</option></select>
              <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 13 }}><option>Last 30 Days</option><option>Last 90 Days</option><option>This Year</option></select>
              <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 13 }}><option>By Week</option><option>By Month</option></select>
              <button type="button" style={{ height: 42, padding: '0 20px', border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Generate</button>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Export Payouts</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#66708d' }}>{payouts.length.toLocaleString()} total payouts available for export.</p>
            <div style={{ maxWidth: 420, display: 'grid', gap: 16 }}>
              <div style={{ padding: '14px 16px', border: '1px solid #e6e9f2', borderRadius: 10, background: '#fbf9ff', fontSize: 13 }}>
                <div style={{ fontWeight: 650, marginBottom: 4, color: '#101944' }}>Columns included:</div>
                <div style={{ color: '#66708d' }}>Recipient, Email, Campaign, Amount (USD), Status, Method, Date</div>
              </div>
              <button
                type="button"
                style={{ height: 44, border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => exportCsv(payouts)}
              >
                Download CSV ({payouts.length.toLocaleString()} rows)
              </button>
              <button
                type="button"
                style={{ height: 44, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#551cf2' }}
                onClick={() => exportCsv(filtered)}
              >
                Export Current Filter ({filtered.length.toLocaleString()} rows)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Payout Audit Log</h3>
              {!auditLoading && auditEntries === null && (
                <button type="button" onClick={loadAuditLog} style={{ height: 36, padding: '0 16px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Load Log</button>
              )}
            </div>
            {auditLoading && <div style={{ padding: '24px 0', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>Loading audit log…</div>}
            {!auditLoading && auditEntries !== null && auditEntries.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No payout audit entries yet.</div>
            )}
            {!auditLoading && auditEntries && auditEntries.map(e => {
              const isGood = e.action.includes('paid') || e.action.includes('approv');
              const isBad = e.action.includes('reject') || e.action.includes('cancel') || e.action.includes('fail');
              const color = isGood ? '#19b86a' : isBad ? '#ff3b5f' : '#6c35ff';
              const amtCents = (e.metadata as { amount_cents?: number }).amount_cents;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, color: '#26335c' }}>{e.action.replace('payout.', '').replace(/_/g, ' ')}</span>
                    <span style={{ color: '#8c9ab5', marginLeft: 8, fontSize: 11 }}>by {e.actorName}</span>
                  </div>
                  {amtCents && <strong style={{ color: '#101944' }}>{fmtCents(amtCents)}</strong>}
                  <span style={{ color: '#8c9ab5', fontSize: 11 }}>{new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selected && <PayoutDetailPanel payout={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
