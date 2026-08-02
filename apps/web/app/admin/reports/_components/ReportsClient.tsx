'use client';

import { useEffect, useState } from 'react';
import { KFIcon, StatusPill } from '../../../../components/CharitMeApp';

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}

export type ReportItem = {
  id: string;
  name: string;
  category: string;
  createdBy: string;
  status: 'Completed' | 'Failed' | 'Live';
  createdOn: string;
  value: string;
  description: string;
};

type CategoryBreakdown = {
  label: string;
  count: number;
  color: string;
};

type Props = {
  reports: ReportItem[];
  categories: CategoryBreakdown[];
  totalReports: number;
  scheduledReports: number;
  totalExports: number;
  dataPoints: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  Finance: 'var(--brand-text)',
  Campaigns: 'var(--pink-text)',
  Users: 'var(--blue-text)',
  Engagement: 'var(--green-text)',
  System: 'var(--orange-text)',
  Payouts: 'var(--red-text)',
};

export default function ReportsClient({ reports, categories, totalReports, scheduledReports, totalExports, dataPoints }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [exportReport, setExportReport] = useState<ReportItem | null>(null);
  const [exportFmt, setExportFmt] = useState<'CSV' | 'Excel' | 'PDF'>('CSV');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  useEscape(() => setExportReport(null));

  async function downloadReport() {
    if (!exportReport) return;
    setExportLoading(true);
    setExportError('');
    try {
      const res = await fetch('/api/admin/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: exportReport.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setExportError(err.error ?? 'Export failed.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportReport.id}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportReport(null);
    } catch {
      setExportError('Network error. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }

  const allCategories = ['All', ...categories.map(c => c.label)];

  const filtered = reports.filter(r => {
    const matchesSearch = search === '' ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'All' || r.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const metrics = [
    { label: 'Total Reports', value: totalReports.toString(), tone: 'violet' as const, icon: 'doc' },
    { label: 'Scheduled Reports', value: scheduledReports.toString(), tone: 'green' as const, icon: 'check' },
    { label: 'Total Exports', value: totalExports.toString(), tone: 'blue' as const, icon: 'upload' },
    { label: 'Data Points', value: dataPoints.toLocaleString(), tone: 'orange' as const, icon: 'chart' },
  ];

  return (
    <div style={{ padding: '0 32px 32px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 22 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18 }}>
        {metrics.map((m) => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}><KFIcon name={m.icon} /></div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          </article>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* Left: category overview + donut */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
          {/* Category breakdown */}
          <section className="kf-card" style={{ padding: 20 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Reports Overview</h2>
            {categories.map((c) => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <i style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                <b style={{ fontSize: 13, fontWeight: 700 }}>{c.count}</b>
              </div>
            ))}
            {/* Simple donut */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg viewBox="0 0 42 42" style={{ width: 120, height: 120, transform: 'rotate(-90deg)' }}>
                  {(() => {
                    const total = categories.reduce((s, c) => s + c.count, 0) || 1;
                    return categories.map((c, i) => {
                      const pct = (c.count / total) * 100;
                      const offset = 100 - categories
                        .slice(0, i)
                        .reduce((sum, item) => sum + (item.count / total) * 100, 0);
                      return (
                        <circle
                          key={i}
                          cx={21} cy={21} r={15.9}
                          fill="none"
                          stroke={c.color}
                          strokeWidth={6}
                          strokeDasharray={`${pct} ${100 - pct}`}
                          strokeDashoffset={offset}
                        />
                      );
                    });
                  })()}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <strong style={{ fontSize: 18, fontWeight: 800 }}>{totalReports}</strong>
                  <small style={{ color: 'var(--t3)', fontSize: 10 }}>reports</small>
                </div>
              </div>
            </div>
          </section>

          {/* Recent reports */}
          <section className="kf-card" style={{ overflow: 'hidden' }}>
            <div className="kf-card-head"><h2>Recent Reports</h2></div>
            {reports.slice(0, 5).map(r => (
              <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid #eef0f7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 12, fontWeight: 650, flex: 1 }}>{r.name}</strong>
                  <StatusPill>{r.status}</StatusPill>
                </div>
                <small style={{ color: 'var(--t3)', fontSize: 11 }}>{r.category} · {r.createdOn}</small>
              </div>
            ))}
          </section>
        </div>

        {/* Right: all reports table */}
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head">
            <h2>All Reports</h2>
          </div>

          {/* Search + category filter */}
          <div style={{ padding: '0 20px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="kf-search" style={{ width: 260, height: 44 }}>
              <KFIcon name="search" />
              <input
                placeholder="Search reports..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 650,
                    border: '1px solid', cursor: 'pointer',
                    // All three were hardcoded light values under a THEMED text
                    // colour. In dark mode --brand-text goes light (#b9a5ff) and
                    // landed on the fixed #f0eaff chip at 1.81:1. Surface and
                    // text have to move together.
                    borderColor: activeCategory === cat ? 'var(--brand-text)' : 'var(--b1)',
                    background: activeCategory === cat ? 'var(--tint-violet)' : 'var(--s1)',
                    color: activeCategory === cat ? 'var(--brand-text)' : 'var(--t1)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Header and rows share ONE scroll box: two boxes would scroll
              independently and the columns would drift out of alignment. */}
          <div className="kf-table-scroll">
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 120px 90px 80px 80px', gap: 12, padding: '8px 20px', background: 'var(--s2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' }}>
            <span>Report Name</span>
            <span>Category</span>
            <span>Created By</span>
            <span>Status</span>
            <span>Date</span>
            <span>Actions</span>
          </div>

          {/* Table rows */}
          {filtered.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 110px 120px 90px 80px 80px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #eef0f7', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{r.name}</strong>
                <small style={{ color: 'var(--t3)', fontSize: 11 }}>{r.description}</small>
              </div>
              <span style={{ fontSize: 12, fontWeight: 650, color: CATEGORY_COLORS[r.category] ?? 'var(--brand-text)' }}>
                {r.category}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>{r.createdBy}</span>
              <StatusPill>{r.status}</StatusPill>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>{r.createdOn}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setExportReport(r)}
                  style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid #e0e4ef', background: 'var(--s1)', color: 'var(--brand-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  Export
                </button>
              </div>
            </div>
          ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)', fontSize: 13 }}>
              No reports match your filter.
            </div>
          )}
        </section>
      </div>

      {/* Export Modal */}
      {exportReport && (
        // Backdrop dismissal is supplementary; Escape and the close action remain available.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }} onClick={event => { if (event.target === event.currentTarget) setExportReport(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="export-report-title" style={{ width: 380, padding: 28, borderRadius: 16, background: 'var(--s1)', boxShadow: '0 24px 80px rgba(55,42,130,.18)' }}>
            <h2 id="export-report-title" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>Export Report</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--t3)', fontSize: 13 }}>{exportReport.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
              {(['CSV', 'Excel', 'PDF'] as const).map(fmt => (
                <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: `1px solid ${exportFmt === fmt ? '#6c35ff' : '#e0e4ef'}`, borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 650 }}>
                  <input type="radio" name="fmt" value={fmt} checked={exportFmt === fmt} onChange={() => setExportFmt(fmt)} />
                  Export as {fmt}
                </label>
              ))}
            </div>
            {exportError && <p style={{ margin: '10px 0 0', color: 'var(--red-text)', fontSize: 13 }}>{exportError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setExportReport(null); setExportError(''); }} style={{ height: 42, padding: '0 20px', border: '1px solid #e0e4ef', borderRadius: 8, background: 'var(--s1)', fontWeight: 650, cursor: 'pointer' }}>Cancel</button>
              <button className="kf-primary" style={{ height: 42, padding: '0 22px', opacity: exportLoading ? 0.7 : 1 }} onClick={downloadReport} disabled={exportLoading}>{exportLoading ? 'Exporting…' : 'Download'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
