'use client';

import React, { useState, useMemo } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface DonationRecord {
  id: string;
  donor_name: string;
  donor_email: string;
  campaign_title: string;
  amount_cents: number;
  status: string;
  payment_method: string | null;
  anonymous: boolean;
  message: string | null;
  created_at: string;
}

export interface WeekPoint {
  week: string;
  total_cents: number;
  count: number;
}

export interface CampaignVolume {
  campaign_id: string;
  campaign_title: string;
  total_cents: number;
}

export interface TopDonor {
  donor_id: string;
  donor_name: string;
  total_cents: number;
  donation_count: number;
}

export interface DonationsClientProps {
  totalCents: number;
  donorCount: number;
  avgCents: number;
  totalDonationCount: number;
  completedCount: number;
  pendingCount: number;
  refundedCount: number;
  failedCount: number;
  donations: DonationRecord[];
  weeklyTrend: WeekPoint[];
  campaignVolumes: CampaignVolume[];
  topDonors: TopDonor[];
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
// Mini SVG line chart
// ─────────────────────────────────────────────
function TrendLine({ points }: { points: WeekPoint[] }) {
  if (points.length < 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#8c9ab5', fontSize: 14 }}>
        Not enough data for chart
      </div>
    );
  }
  const W = 480;
  const H = 180;
  const pad = 16;
  const maxVal = Math.max(...points.map(p => p.total_cents), 1);
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (W - pad * 2));
  const ys = points.map(p => pad + (1 - p.total_cents / maxVal) * (H - pad * 2));
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const areaD = `${pathD} L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }} role="img" aria-label="Donation trend">
      <defs>
        <linearGradient id="donGrad" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#6c35ff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#6c35ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad} y1={pad + (1 - f) * (H - pad * 2)} x2={W - pad} y2={pad + (1 - f) * (H - pad * 2)} stroke="#eef0f7" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#donGrad)" />
      <path d={pathD} fill="none" stroke="#6c35ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="5" fill="#6c35ff" stroke="#fff" strokeWidth="3" />
      ))}
      {points.map((p, i) => (
        <text key={i} x={xs[i]} y={H - 2} textAnchor="middle" fontSize="10" fill="#8c9ab5">
          {p.week.slice(5)}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Mini donut chart
// ─────────────────────────────────────────────
function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 1);
  const r = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg viewBox="0 0 160 160" style={{ width: 120, height: 120, flexShrink: 0 }}>
        {slices.map((s, index) => {
          const frac = s.value / total;
          const dash = frac * circumference;
          const offset = slices.slice(0, index).reduce((sum, item) => sum + (item.value / total), 0);
          return (
            <circle key={s.label}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="24"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset * circumference + circumference / 4}
              style={{ transition: 'all .3s' }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 12} fill="#fff" />
      </svg>
      <div style={{ display: 'grid', gap: 8 }}>
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
  const tone = s.includes('completed') || s.includes('success') ? 'green'
    : s.includes('pending') ? 'orange'
    : s.includes('refunded') ? 'violet'
    : s.includes('failed') ? 'red'
    : 'violet';
  return <span className={`kf-pill ${tone}`}>{capitalize(status)}</span>;
}

// ─────────────────────────────────────────────
// Detail slide-in panel
// ─────────────────────────────────────────────
function DetailPanel({ donation, onClose }: { donation: DonationRecord; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState('info');
  const tabs = ['info', 'history', 'actions'];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        background: 'rgba(10,15,60,.38)', backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        marginLeft: 'auto', width: 480, background: '#fff',
        height: '100%', overflowY: 'auto',
        boxShadow: '-12px 0 56px rgba(20,20,80,.14)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid #eef0f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 950, color: '#0f0f30' }}>{donation.donor_name}</div>
            <div style={{ fontSize: 13, color: '#66708d', marginTop: 2 }}>{donation.donor_email || 'No email'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StatusPill status={donation.status} />
            <button type="button" onClick={onClose}
              style={{ width: 32, height: 32, border: '1px solid #e6e9f2', borderRadius: '50%', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c9ab5', lineHeight: 1 }}>
              ×
            </button>
          </div>
        </div>

        {/* Amount */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef0f7', background: '#fbf9ff' }}>
          <div style={{ fontSize: 32, fontWeight: 950, color: '#101944', letterSpacing: '-.03em' }}>{fmtCents(donation.amount_cents)}</div>
          <div style={{ fontSize: 13, color: '#66708d', marginTop: 4 }}>{fmtDate(donation.created_at)}</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eef0f7', padding: '0 24px' }}>
          {tabs.map(t => (
            <button key={t} type="button" onClick={() => setActiveTab(t)}
              style={{
                height: 44, border: 0, borderBottom: `2px solid ${activeTab === t ? '#6c35ff' : 'transparent'}`,
                background: 'none', fontWeight: activeTab === t ? 950 : 750, fontSize: 13,
                color: activeTab === t ? '#551cf2' : '#66708d', marginRight: 20, cursor: 'pointer',
              }}>
              {capitalize(t)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {activeTab === 'info' && (
            <div style={{ display: 'grid', gap: 14 }}>
              {[
                ['Campaign', donation.campaign_title],
                ['Amount', fmtCents(donation.amount_cents)],
                ['Status', capitalize(donation.status)],
                ['Payment Method', donation.payment_method || 'N/A'],
                ['Donation ID', donation.id.slice(0, 18) + '...'],
                ['Donated On', fmtDate(donation.created_at)],
                ['Anonymous', donation.anonymous ? 'Yes' : 'No'],
                ['Message', donation.message || '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <span style={{ color: '#66708d', fontWeight: 700 }}>{label}</span>
                  <span style={{ color: '#101944', fontWeight: 750, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { event: 'Donation Received', date: donation.created_at, color: '#0fa456' },
                { event: `Status: ${capitalize(donation.status)}`, date: donation.created_at, color: '#6c35ff' },
              ].map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: ev.color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 750, color: '#101944' }}>{ev.event}</div>
                    <div style={{ fontSize: 12, color: '#8c9ab5', marginTop: 2 }}>{fmtDate(ev.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'actions' && (
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'Refund Donation', color: '#ff3b5f', bg: '#fff0f3' },
                { label: 'Send Receipt', color: '#2563eb', bg: '#eaf1ff' },
                { label: 'Mark as Spam', color: '#f97316', bg: '#fff0e4' },
                { label: 'Add Note', color: '#551cf2', bg: '#f0eaff' },
                { label: 'View Donor Profile', color: '#0fa456', bg: '#e8f8ee' },
              ].map(({ label, color, bg }) => (
                <button key={label} type="button"
                  style={{ width: '100%', height: 44, border: `1px solid ${color}20`, borderRadius: 10, background: bg, color, fontWeight: 850, fontSize: 13, cursor: 'pointer' }}
                  onClick={() => alert(`Action: ${label}`)}>
                  {label}
                </button>
              ))}
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
export default function DonationsClient({
  totalCents,
  donorCount,
  avgCents,
  totalDonationCount,
  completedCount,
  pendingCount,
  refundedCount,
  failedCount,
  donations,
  weeklyTrend,
  campaignVolumes,
  topDonors,
}: DonationsClientProps) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected] = useState<DonationRecord | null>(null);
  const [exportFormat, setExportFormat] = useState('csv');

  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    let list = donations;
    if (filterStatus !== 'all') list = list.filter(d => d.status.toLowerCase() === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.donor_name.toLowerCase().includes(q) ||
        d.donor_email.toLowerCase().includes(q) ||
        d.campaign_title.toLowerCase().includes(q)
      );
    }
    return list;
  }, [donations, filterStatus, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusTabs = [
    { id: 'all', label: `All (${totalDonationCount})` },
    { id: 'completed', label: `Completed (${completedCount})` },
    { id: 'pending', label: `Pending (${pendingCount})` },
    { id: 'refunded', label: `Refunded (${refundedCount})` },
    { id: 'failed', label: `Failed (${failedCount})` },
  ];

  const panelTabs = ['Donations', 'Donors', 'Recurring', 'Refunds', 'Reports', 'Export', 'Audit'];

  const top5Campaigns = campaignVolumes.slice(0, 5);
  const othersTotal = campaignVolumes.slice(5).reduce((s, c) => s + c.total_cents, 0);
  const campaignTotal = campaignVolumes.reduce((s, c) => s + c.total_cents, 1);

  const recentFive = donations.slice(0, 5);

  return (
    <div style={{ padding: '0 32px 40px' }}>
      {/* KPI row */}
      <div className="kf-metrics" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Donations', value: fmtCents(totalCents), change: 'Completed donations', icon: 'gift', tone: 'violet' },
          { label: 'Total Donors', value: donorCount.toLocaleString(), change: 'Unique donors', icon: 'users', tone: 'green' },
          { label: 'Average Donation', value: fmtCents(avgCents), change: 'Per completed tx', icon: 'chart', tone: 'blue' },
          { label: 'Total Count', value: totalDonationCount.toLocaleString(), change: 'All donations', icon: 'check', tone: 'orange' },
        ].map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={22} height={22} strokeLinecap="round" strokeLinejoin="round">
                {m.icon === 'gift' && <><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2-4L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2-4L12 7Z"/></>}
                {m.icon === 'users' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>}
                {m.icon === 'chart' && <><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></>}
                {m.icon === 'check' && <path d="M20 6L9 17l-5-5"/>}
              </svg>
            </div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
              <small>{m.change}</small>
            </div>
          </article>
        ))}
      </div>

      {/* Charts row */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card kf-chart">
          <div className="kf-card-head">
            <h2>Donation Trend</h2>
            <span style={{ fontSize: 12, color: '#8c9ab5' }}>Last 8 weeks</span>
          </div>
          <div style={{ padding: '0 18px 12px' }}>
            <TrendLine points={weeklyTrend} />
          </div>
        </section>

        <section className="kf-card">
          <div className="kf-card-head"><h2>Donations by Campaign</h2></div>
          <div style={{ padding: '0 20px 20px' }}>
            <DonutChart slices={
              [...top5Campaigns.map(c => ({
                label: c.campaign_title.slice(0, 20) + (c.campaign_title.length > 20 ? '…' : ''),
                value: Math.round(c.total_cents / 100),
                color: ['#6c35ff','#ec3fb4','#2f80ed','#19b86a','#f59e0b'][top5Campaigns.indexOf(c) % 5],
              })),
              ...(othersTotal > 0 ? [{ label: 'Others', value: Math.round(othersTotal / 100), color: '#a9afc2' }] : [])
              ]
            } />
            <div style={{ marginTop: 12 }}>
              {top5Campaigns.map(c => (
                <div key={c.campaign_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                  <span style={{ color: '#26335c', fontWeight: 700 }}>{c.campaign_title.slice(0, 28)}</span>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: '#101944' }}>{fmtCents(c.total_cents)}</strong>
                    <span style={{ color: '#8c9ab5', fontSize: 11, marginLeft: 6 }}>{Math.round((c.total_cents / campaignTotal) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Recent donations + Top donors */}
      <div className="kf-two-col" style={{ marginBottom: 24 }}>
        <section className="kf-card">
          <div className="kf-card-head"><h2>Recent Donations</h2></div>
          <div>
            {recentFive.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #f0f2f8' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 950, color: '#fff', flexShrink: 0 }}>
                  {d.donor_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 850, color: '#101944', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.donor_name}</div>
                  <div style={{ fontSize: 12, color: '#66708d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.campaign_title}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 950, color: '#101944' }}>{fmtCents(d.amount_cents)}</div>
                  <div style={{ fontSize: 11, color: '#8c9ab5' }}>{fmtDate(d.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 48, display: 'grid', placeItems: 'center', borderTop: '1px solid #f0f2f8' }}>
            <button type="button" style={{ background: 'none', border: 'none', color: '#551cf2', fontWeight: 950, fontSize: 14, cursor: 'pointer' }}
              onClick={() => setActiveTab('Donations')}>
              View all donations →
            </button>
          </div>
        </section>

        <section className="kf-card">
          <div className="kf-card-head"><h2>Top Donors</h2></div>
          <div>
            {topDonors.slice(0, 5).map((d, i) => (
              <div key={d.donor_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f0f2f8' }}>
                <span style={{ width: 22, textAlign: 'center', fontSize: 12, fontWeight: 900, color: '#8c9ab5' }}>{i + 1}</span>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 950, color: '#fff', flexShrink: 0 }}>
                  {d.donor_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 850, color: '#101944' }}>{d.donor_name}</div>
                  <div style={{ fontSize: 12, color: '#66708d' }}>{d.donation_count} donation{d.donation_count !== 1 ? 's' : ''}</div>
                </div>
                <strong style={{ fontSize: 15, color: '#101944' }}>{fmtCents(d.total_cents)}</strong>
              </div>
            ))}
          </div>
          {topDonors.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No donors yet</div>
          )}
        </section>
      </div>

      {/* Main table section */}
      <section className="kf-card" style={{ marginBottom: 24 }}>
        {/* Panel tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #eef0f7', overflowX: 'auto', padding: '0 20px' }}>
          {panelTabs.map(t => (
            <button key={t} type="button"
              onClick={() => setActiveTab(t)}
              style={{
                height: 50, padding: '0 16px', border: 0, borderBottom: `2px solid ${activeTab === t ? '#6c35ff' : 'transparent'}`,
                background: 'none', fontWeight: activeTab === t ? 950 : 750, fontSize: 13,
                color: activeTab === t ? '#551cf2' : '#202b55', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Donations tab */}
        {activeTab === 'Donations' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #eef0f7', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', background: '#fff' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#8c9ab5" strokeWidth={2} width={16} height={16}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search by donor, email, or campaign…"
                  style={{ border: 0, outline: 0, background: 'transparent', fontSize: 13, width: '100%' }} />
              </label>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}
                style={{ height: 42, border: '1px solid #e0e4ef', borderRadius: 9, padding: '0 14px', fontSize: 13, background: '#fff' }}>
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
              </select>
              <button type="button"
                style={{ height: 42, padding: '0 18px', border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 750, cursor: 'pointer' }}
                onClick={() => alert('Export as ' + exportFormat.toUpperCase())}>
                Export
              </button>
            </div>

            {/* Status filter tabs */}
            <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: '1px solid #eef0f7' }}>
              {statusTabs.map(t => (
                <button key={t.id} type="button"
                  onClick={() => { setFilterStatus(t.id); setPage(0); }}
                  style={{
                    height: 44, padding: '0 14px', border: 0, borderBottom: `2px solid ${filterStatus === t.id ? '#6c35ff' : 'transparent'}`,
                    background: 'none', fontWeight: filterStatus === t.id ? 950 : 700, fontSize: 12,
                    color: filterStatus === t.id ? '#551cf2' : '#66708d', cursor: 'pointer',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 130px', gap: 12, padding: '10px 20px', background: '#f8f9fc', borderBottom: '1px solid #eef0f7', fontSize: 11, fontWeight: 900, color: '#8c9ab5', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Donor</span>
              <span>Campaign</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Date</span>
            </div>

            {/* Table rows */}
            {currentPage.map(d => (
              <div key={d.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 130px', gap: 12, padding: '14px 20px', borderBottom: '1px solid #f0f2f8', cursor: 'pointer', alignItems: 'center' }}
                onClick={() => setSelected(d)}
                onMouseEnter={e => (e.currentTarget.style.background = '#fbf9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 950, color: '#fff', flexShrink: 0 }}>
                    {d.donor_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 850, color: '#101944' }}>{d.donor_name}</div>
                    {d.donor_email && <div style={{ fontSize: 11, color: '#8c9ab5' }}>{d.donor_email}</div>}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#26335c', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.campaign_title}</div>
                <div style={{ fontSize: 14, fontWeight: 950, color: '#101944' }}>{fmtCents(d.amount_cents)}</div>
                <StatusPill status={d.status} />
                <div style={{ fontSize: 12, color: '#8c9ab5' }}>{fmtDate(d.created_at)}</div>
              </div>
            ))}

            {currentPage.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#8c9ab5', fontSize: 14 }}>No donations found</div>
            )}

            {/* Pagination */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #eef0f7' }}>
              <span style={{ fontSize: 13, color: '#66708d' }}>
                Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}>
                  ← Prev
                </button>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
                  style={{ height: 34, padding: '0 14px', border: '1px solid #e0e4ef', borderRadius: 8, background: '#fff', cursor: page >= pages - 1 ? 'default' : 'pointer', opacity: page >= pages - 1 ? 0.4 : 1, fontSize: 13 }}>
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Donors tab */}
        {activeTab === 'Donors' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 950 }}>Top Donors</h3>
            {topDonors.slice(0, 10).map((d, i) => (
              <div key={d.donor_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #f0f2f8' }}>
                <span style={{ width: 28, fontSize: 13, fontWeight: 900, color: i < 3 ? '#6c35ff' : '#8c9ab5' }}>#{i + 1}</span>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 950, color: '#fff', flexShrink: 0 }}>
                  {d.donor_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 850, color: '#101944' }}>{d.donor_name}</div>
                  <div style={{ fontSize: 12, color: '#66708d' }}>{d.donation_count} donation{d.donation_count !== 1 ? 's' : ''}</div>
                </div>
                <strong style={{ fontSize: 16, fontWeight: 950, color: '#101944' }}>{fmtCents(d.total_cents)}</strong>
              </div>
            ))}
            {topDonors.length === 0 && <p style={{ color: '#8c9ab5', fontSize: 14 }}>No donor data available</p>}
          </div>
        )}

        {/* Recurring tab */}
        {activeTab === 'Recurring' && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Recurring', value: totalDonationCount, color: '#6c35ff' },
                { label: 'Active', value: completedCount, color: '#19b86a' },
                { label: 'Paused', value: pendingCount, color: '#f97316' },
                { label: 'Cancelled', value: 0, color: '#ff3b5f' },
              ].map(s => (
                <div key={s.label} style={{ padding: '18px', border: '1px solid #e6e9f2', borderRadius: 12, background: '#fff' }}>
                  <div style={{ fontSize: 12, color: '#66708d', marginBottom: 6, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 950, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#8c9ab5', fontSize: 14 }}>Recurring donation management coming soon.</p>
          </div>
        )}

        {/* Refunds tab */}
        {activeTab === 'Refunds' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 950 }}>Process Refund</h3>
            <div style={{ maxWidth: 460, display: 'grid', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Refund Amount ($)
                <input type="number" placeholder="0.00" style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Reason
                <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}>
                  <option>Duplicate charge</option>
                  <option>Fraudulent</option>
                  <option>Donor request</option>
                  <option>Other</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Note
                <textarea placeholder="Optional note..." style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '10px 14px', fontSize: 14, minHeight: 80, resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" style={{ flex: 1, height: 42, border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 750, cursor: 'pointer' }}>Cancel</button>
                <button type="button" style={{ flex: 1, height: 42, border: 0, borderRadius: 9, background: '#ff3b5f', color: '#fff', fontSize: 13, fontWeight: 950, cursor: 'pointer' }}
                  onClick={() => alert('Refund processed')}>Process Refund</button>
              </div>
            </div>
          </div>
        )}

        {/* Reports tab */}
        {activeTab === 'Reports' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 950 }}>Reports & Analytics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {['Donation Summary', 'Donor Insights', 'Campaign Performance', 'Payment Methods', 'Recurring Donations', 'Custom Report'].map(r => (
                <button key={r} type="button"
                  style={{ height: 64, border: '1px solid #e6e9f2', borderRadius: 12, background: '#fff', fontSize: 14, fontWeight: 750, color: '#26335c', cursor: 'pointer' }}
                  onClick={() => alert(`Generating: ${r}`)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Export tab */}
        {activeTab === 'Export' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 950 }}>Export Data</h3>
            <div style={{ maxWidth: 460, display: 'grid', gap: 16 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Data Type
                <select style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}><option>Donations</option></select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 750, color: '#26335c' }}>
                Format
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={{ height: 42, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 14px', fontSize: 14 }}>
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
              <button type="button"
                style={{ height: 44, border: 0, borderRadius: 9, background: '#551cf2', color: '#fff', fontSize: 14, fontWeight: 950, cursor: 'pointer' }}
                onClick={() => fetch('/api/admin/reports/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: exportFormat, type: 'donations' }) }).then(() => alert('Export started'))}>
                Export Donations
              </button>
            </div>
          </div>
        )}

        {/* Audit tab */}
        {activeTab === 'Audit' && (
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 950 }}>Audit Log</h3>
            {[
              { event: 'Refund processed', amount: '$50.00', time: '2 hours ago', color: '#ff3b5f' },
              { event: 'Note added to donation', amount: '', time: '5 hours ago', color: '#6c35ff' },
              { event: 'Receipt sent', amount: '$120.00', time: '1 day ago', color: '#2563eb' },
              { event: 'Status changed to Completed', amount: '$75.00', time: '2 days ago', color: '#0fa456' },
            ].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f0f2f8', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#26335c', fontWeight: 700 }}>{e.event}</span>
                {e.amount && <strong style={{ color: '#101944' }}>{e.amount}</strong>}
                <span style={{ color: '#8c9ab5' }}>{e.time}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Detail panel */}
      {selected && <DetailPanel donation={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
