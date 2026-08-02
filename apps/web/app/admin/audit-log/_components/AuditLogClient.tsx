'use client';

import { useEffect, useState } from 'react';
import { KFIcon, StatusPill } from '../../../../components/CharitMeApp';

export type AuditEvent = {
  id: string;
  dateTime: string;
  user: string;
  action: string;
  category: string;
  status: string;
  eventType: string;
  stripeEventId: string | null;
  processingError: string | null;
  targetType?: string;
  ipAddress?: string;
};

export type DayPoint = { label: string; count: number };

export type CategoryCount = { label: string; count: number; color: string };

type Props = {
  events: AuditEvent[];
  totalEvents: number;
  uniqueUsers: number;
  categories: CategoryCount[];
  failedCount: number;
  dayPoints: DayPoint[];
};

const CATEGORY_COLORS: Record<string, string> = {
  Payments: 'var(--brand-text)',
  Charges: 'var(--pink-text)',
  Customers: 'var(--blue-text)',
  Checkout: 'var(--green-text)',
  Payouts: 'var(--orange-text)',
  Invoices: 'var(--red-text)',
  Subscriptions: 'var(--brand-text)',
  System: 'var(--t3)',
};

function MiniLineChart({ points }: { points: DayPoint[] }) {
  if (points.length < 2) return <div style={{ height: 120, display: 'grid', placeItems: 'center', color: 'var(--t3)', fontSize: 12 }}>No data</div>;

  const maxVal = Math.max(...points.map(p => p.count), 1);
  const W = 520;
  const H = 100;
  const padL = 10;
  const padR = 10;
  const padT = 12;
  const padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xStep = innerW / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: padL + i * xStep,
    y: padT + innerH - (p.count / maxVal) * innerH,
  }));

  const pathD = coords.map((c, i) => (i === 0 ? `M${c.x} ${c.y}` : `L${c.x} ${c.y}`)).join(' ');
  const areaD = `${pathD} L${coords[coords.length - 1].x} ${H - padB} L${coords[0].x} ${H - padB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
      <defs>
        <linearGradient id="auditLine" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#6c35ff" stopOpacity=".18" />
          <stop offset="1" stopColor="#6c35ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#auditLine)" />
      <path d={pathD} fill="none" stroke="#6c35ff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Day labels every 5 */}
      {points.filter((_, i) => i % 5 === 0).map((p, idx) => {
        const origIdx = idx * 5;
        return (
          <text key={origIdx} x={coords[origIdx].x} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--t3)">{p.label}</text>
        );
      })}
    </svg>
  );
}

function CategoryDonut({ categories }: { categories: CategoryCount[] }) {
  const total = categories.reduce((s, c) => s + c.count, 0) || 1;
  return (
    <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 24, padding: '10px 20px 20px' }}>
      <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
        <svg viewBox="0 0 42 42" style={{ width: 110, height: 110, transform: 'rotate(-90deg)' }}>
          {categories.map((c, i) => {
            const pct = (c.count / total) * 100;
            const cum = categories.slice(0, i).reduce((sum, item) => sum + (item.count / total) * 100, 0);
            const offset = 100 - cum;
            return (
              <circle key={i} cx={21} cy={21} r={15.9} fill="none" stroke={c.color} strokeWidth={6}
                strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <strong style={{ fontSize: 16, fontWeight: 700 }}>{total.toLocaleString()}</strong>
          <small style={{ color: 'var(--t3)', fontSize: 9 }}>events</small>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {categories.map(c => (
          <div key={c.label} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.label}</span>
            <b style={{ fontSize: 12, fontWeight: 700 }}>{c.count}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportEventsCsv(events: AuditEvent[]) {
  const header = ['DateTime', 'Action', 'Category', 'Status', 'EventType', 'StripeEventId'].join(',');
  const rows = events.map(e => [e.dateTime, e.action, e.category, e.status, e.eventType, e.stripeEventId ?? '']
    .map(v => `"${String(v).replace(/"/g, '""')}"`)
    .join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogClient({ events, totalEvents, uniqueUsers, categories, failedCount, dayPoints }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (!selectedEvent && !showExportModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSelectedEvent(null);
      setShowExportModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEvent, showExportModal]);
  const [exportFmt, setExportFmt] = useState<'CSV' | 'Excel' | 'PDF'>('CSV');

  const categoryNames = ['All', ...categories.map(c => c.label)];

  const filtered = events.filter(e => {
    const matchesSearch = search === '' ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.user.toLowerCase().includes(search.toLowerCase()) ||
      (e.stripeEventId?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || e.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 22 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18 }}>
        {[
          { label: 'Total Events', value: totalEvents.toLocaleString(), icon: 'audit', tone: 'violet' as const },
          { label: 'Unique Users', value: uniqueUsers.toLocaleString(), icon: 'users', tone: 'green' as const },
          { label: 'Categories', value: categories.length.toString(), icon: 'stack', tone: 'blue' as const },
          { label: 'Failed Events', value: failedCount.toLocaleString(), icon: 'doc', tone: 'orange' as const },
        ].map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}><KFIcon name={m.icon} /></div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          </article>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 320px)', gap: 18 }}>
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head"><h2>Activity Over Time</h2><span style={{ color: 'var(--t3)', fontSize: 13 }}>Last 30 days</span></div>
          <div style={{ padding: '0 10px 8px' }}>
            <MiniLineChart points={dayPoints} />
          </div>
        </section>
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head"><h2>Events by Category</h2></div>
          <CategoryDonut categories={categories} />
        </section>
      </div>

      {/* Recent feed + main table layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 280px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* Recent activity feed */}
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head"><h2>Recent Activity</h2></div>
          {events.slice(0, 8).map(e => (
            <div
              key={e.id}
              onClick={() => setSelectedEvent(e)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedEvent(e);
                }
              }}
              role="button"
              tabIndex={0}
              style={{ padding: '10px 16px', borderBottom: '1px solid #eef0f7', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 650, color: CATEGORY_COLORS[e.category] ?? 'var(--brand-text)' }}>{e.category}</span>
                <StatusPill>{e.status}</StatusPill>
              </div>
              <strong style={{ display: 'block', fontSize: 12, fontWeight: 650, marginBottom: 2 }}>{e.action}</strong>
              <small style={{ color: 'var(--t3)', fontSize: 10 }}>{e.dateTime}</small>
            </div>
          ))}
        </section>

        {/* Main audit log table */}
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head">
            <h2>Audit Log</h2>
            <button
              onClick={() => setShowExportModal(true)}
              className="kf-outline"
              style={{ height: 40, padding: '0 16px', fontSize: 13 }}
            >
              <KFIcon name="upload" /> Export Logs
            </button>
          </div>

          {/* Filters */}
          <div style={{ padding: '0 20px 14px', display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="kf-search" style={{ width: 240, height: 40 }}>
              <KFIcon name="search" />
              <input
                placeholder="Search events..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ height: 40, border: '1px solid #e0e4ef', borderRadius: 8, padding: '0 12px', fontSize: 12, background: 'var(--s1)', cursor: 'pointer' }}
            >
              {categoryNames.map(c => <option key={c}>{c}</option>)}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: 40, border: '1px solid #e0e4ef', borderRadius: 8, padding: '0 12px', fontSize: 12, background: 'var(--s1)', cursor: 'pointer' }}
            >
              <option>All</option>
              <option>Processed</option>
              <option>Failed</option>
              <option>Pending</option>
            </select>
          </div>

          {/* One scroll box around the header AND the rows: separate boxes
              would scroll independently and the columns would drift apart. */}
          <div className="kf-table-scroll">
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 130px) minmax(0, 1fr) minmax(0, 110px) 90px 80px', gap: 12, padding: '8px 20px', background: 'var(--s2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' }}>
            <span>Date & Time</span>
            <span>Action</span>
            <span>Category</span>
            <span>Status</span>
            <span>Details</span>
          </div>

          {filtered.slice(0, 15).map(e => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 130px) minmax(0, 1fr) minmax(0, 110px) 90px 80px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #eef0f7', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>{e.dateTime}</span>
              <div>
                <strong style={{ display: 'block', fontSize: 12, fontWeight: 650 }}>{e.action}</strong>
                {e.stripeEventId && <small style={{ color: 'var(--t3)', fontSize: 10 }}>{e.stripeEventId.slice(0, 20)}…</small>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 650, color: CATEGORY_COLORS[e.category] ?? 'var(--brand-text)' }}>{e.category}</span>
              <StatusPill>{e.status}</StatusPill>
              <button
                onClick={() => setSelectedEvent(e)}
                style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid #e0e4ef', background: 'var(--s1)', color: 'var(--brand-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                View
              </button>
            </div>
          ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)', fontSize: 13 }}>No events match your filter.</div>
          )}
          {filtered.length > 15 && (
            <div style={{ textAlign: 'center', padding: '14px', color: 'var(--brand-text)', fontSize: 13, fontWeight: 700, borderTop: '1px solid #eef0f7' }}>
              Showing 15 of {filtered.length} — use Export for full data
            </div>
          )}
        </section>
      </div>

      {/* Log details slide-in */}
      {selectedEvent && (
        // Backdrop dismissal is supplementary; Escape and the close button remain available.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9999, display: 'flex', minWidth: 0, alignItems: 'stretch', justifyContent: 'flex-end' }}
          onClick={event => { if (event.target === event.currentTarget) setSelectedEvent(null); }}
        >
          <div
            style={{ width: 420, background: 'var(--s1)', overflowY: 'auto', padding: 28, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignContent: 'start', gap: 18 }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Event Details</h2>
              <button onClick={() => setSelectedEvent(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--t3)' }}>×</button>
            </div>

            <div style={{ padding: 18, border: '1px solid #e6e9f2', borderRadius: 12, background: 'var(--s2)' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Event Summary</h3>
              {[
                ['Date & Time', selectedEvent.dateTime],
                ['Action', selectedEvent.action],
                ['Category', selectedEvent.category],
                ['Performed By', selectedEvent.user],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--t3)', fontWeight: 600 }}>{label}</span>
                  <strong style={{ fontWeight: 650 }}>{val}</strong>
                </div>
              ))}
            </div>

            <div style={{ padding: 18, border: '1px solid #e6e9f2', borderRadius: 12 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Event Type</h3>
              <code style={{ display: 'block', fontSize: 12, fontFamily: 'monospace', background: '#f5f2ff', padding: '10px 12px', borderRadius: 8, wordBreak: 'break-all', color: 'var(--brand-text)' }}>
                {selectedEvent.eventType}
              </code>
              {selectedEvent.stripeEventId && (
                <>
                  <p style={{ margin: '12px 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--t3)' }}>Stripe Event ID</p>
                  <code style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', background: '#f5f2ff', padding: '8px 12px', borderRadius: 8, wordBreak: 'break-all', color: 'var(--t3)' }}>
                    {selectedEvent.stripeEventId}
                  </code>
                </>
              )}
            </div>

            {selectedEvent.processingError && (
              <div style={{ padding: 18, border: '1px solid #fee2e2', borderRadius: 12, background: '#fff8f8' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--red-text)' }}>Processing Error</h3>
                <code style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', color: 'var(--red-text)', wordBreak: 'break-all' }}>
                  {selectedEvent.processingError}
                </code>
              </div>
            )}

            <div style={{ padding: 18, border: '1px solid #e6e9f2', borderRadius: 12 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Request Context</h3>
              {[
                ['IP Address', '—'],
                ['User Agent', 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'],
              ].map(([label, val]) => (
                <div key={label} style={{ marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--t3)', fontWeight: 600 }}>{label}: </span>
                  <span style={{ fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', minWidth: 0, justifyContent: 'flex-end' }}>
              <StatusPill>{selectedEvent.status}</StatusPill>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExportModal && (
        // Backdrop dismissal is supplementary; Escape and the visible buttons remain available.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }} onClick={event => { if (event.target === event.currentTarget) setShowExportModal(false); }}>
          <div style={{ width: 380, padding: 28, borderRadius: 16, background: 'var(--s1)', boxShadow: '0 24px 80px rgba(55,42,130,.18)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Export Audit Logs</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--t3)', fontSize: 13 }}>Choose the format to export {totalEvents.toLocaleString()} events.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
              {(['CSV', 'Excel', 'PDF'] as const).map(fmt => (
                <label key={fmt} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, padding: '14px 16px', border: `1px solid ${exportFmt === fmt ? '#6c35ff' : '#e0e4ef'}`, borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 650 }}>
                  <input type="radio" name="export-fmt" value={fmt} checked={exportFmt === fmt} onChange={() => setExportFmt(fmt)} />
                  Export as {fmt}
                </label>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', color: 'var(--t3)', fontSize: 12 }}>
              {filtered.length.toLocaleString()} filtered events will be exported
            </p>
            <div style={{ display: 'flex', minWidth: 0, gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowExportModal(false)} style={{ height: 42, padding: '0 20px', border: '1px solid #e0e4ef', borderRadius: 8, background: 'var(--s1)', fontWeight: 650, cursor: 'pointer' }}>Cancel</button>
              <button className="kf-primary" style={{ height: 42, padding: '0 22px' }} onClick={() => { exportEventsCsv(filtered); setShowExportModal(false); }}>Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
