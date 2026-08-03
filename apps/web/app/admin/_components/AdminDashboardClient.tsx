'use client';

import { KFIcon, StatusPill } from '../../../components/CharitMeApp';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type DashMetric = {
  label: string;
  value: string;
  change: string;
  tone: 'violet' | 'green' | 'blue' | 'orange';
  icon: string;
};

export type CampaignRow = {
  id: string;
  title: string;
  raised: string;
  goal: string;
  status: string;
};

export type DonationRow = {
  id: string;
  amount: string;
  donor: string;
  campaign: string;
  date: string;
};

export type WeekPoint = { label: string; value: number };

export type SourceItem = { label: string; pct: number; color: string };

export type SystemService = {
  name: string;
  /**
   * `Unknown` exists because the panel used to assert `Operational` for services
   * it never measured, and for one whose only signal (webhook error count) read
   * as 0 whenever its query failed — a false all-clear on exactly the screen an
   * operator opens during an incident.
   */
  status: 'Operational' | 'Degraded' | 'Down' | 'Unknown';
};

type Props = {
  metrics: DashMetric[];
  campaigns: CampaignRow[];
  donations: DonationRow[];
  weekPoints: WeekPoint[];
  sources: SourceItem[];
  services: SystemService[];
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function toneClass(tone: DashMetric['tone']): string {
  return tone;
}

// ─────────────────────────────────────────────
// Inline SVG line chart from weekly points
// ─────────────────────────────────────────────
function WeeklyLineChart({ points }: { points: WeekPoint[] }) {
  if (points.length < 2) {
    return (
      <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--t3)', fontSize: 13 }}>
        Not enough data
      </div>
    );
  }
  const maxVal = Math.max(...points.map(p => p.value), 1);
  const W = 520;
  const H = 200;
  const pad = { left: 12, right: 12, top: 20, bottom: 24 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const xStep = innerW / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: pad.left + i * xStep,
    y: pad.top + innerH - (p.value / maxVal) * innerH,
  }));

  const pathD = coords
    .map((c, i) => (i === 0 ? `M${c.x} ${c.y}` : `L${c.x} ${c.y}`))
    .join(' ');

  const areaD = `${pathD} L${coords[coords.length - 1].x} ${H - pad.bottom} L${coords[0].x} ${H - pad.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220 }} role="img" aria-label="Donations over time">
      <defs>
        <linearGradient id="dashLine" x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#6c35ff" stopOpacity=".20" />
          <stop offset="1" stopColor="#6c35ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8, 1].map((f) => {
        const y = pad.top + innerH * (1 - f);
        return <line key={f} x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="#eef0f7" />;
      })}
      <path d={areaD} fill="url(#dashLine)" />
      <path d={pathD} fill="none" stroke="#6c35ff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={5} fill="#6c35ff" stroke="#fff" strokeWidth={3} />
      ))}
      {/* Axis labels are real text, so AA 4.5 applies. `#8c95b2` measured
          2.80:1 on a white card — fine on dark, which is how it survived a
          sweep that cannot log in to see this page. The token clears the bar
          in both themes. */}
      {points.map((p, i) => (
        <text
          key={`lbl-${i}`}
          x={coords[i].x}
          y={H - 4}
          textAnchor="middle"
          fontSize={9}
          fill="var(--t3)"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Donut chart from sources
// ─────────────────────────────────────────────
function SourceDonut({ sources, total }: { sources: SourceItem[]; total: string }) {
  const totalPct = sources.reduce((s, it) => s + it.pct, 0) || 100;

  return (
    <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 32, padding: '10px 22px 20px' }}>
      <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
        <svg viewBox="0 0 42 42" style={{ width: 150, height: 150, transform: 'rotate(-90deg)' }}>
          {sources.map((src, i) => {
            const pct = (src.pct / totalPct) * 100;
            const offset = 100 - sources
              .slice(0, i)
              .reduce((sum, item) => sum + (item.pct / totalPct) * 100, 0);
            return (
              <circle
                key={i}
                cx={21}
                cy={21}
                r={15.9}
                fill="none"
                stroke={src.color}
                strokeWidth={6}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center',
          textAlign: 'center',
        }}>
          <strong style={{ fontSize: 22, fontWeight: 800 }}>{total}</strong>
          <small style={{ color: 'var(--t3)', fontSize: 11 }}>Total</small>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, flex: 1 }}>
        {sources.map((src) => (
          <p key={src.label} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10, margin: 0, color: 'var(--t1)', fontWeight: 650 }}>
            <i style={{ width: 10, height: 10, borderRadius: '50%', background: src.color, flexShrink: 0 }} />
            {src.label}
            <b style={{ marginLeft: 'auto' }}>{src.pct}%</b>
          </p>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────
export default function AdminDashboardClient({ metrics, campaigns, donations, weekPoints, sources, services }: Props) {
  const totalStr = weekPoints.reduce((s, p) => s + p.value, 0).toLocaleString();

  return (
    <div className="kf-admin-dash">
      {/* KPI metrics */}
      <div className="kf-metrics">
        {metrics.map((m) => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${toneClass(m.tone)}`}><KFIcon name={m.icon} /></div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
              <small style={{ color: m.change.startsWith('+') ? 'var(--green-text)' : 'var(--t2)' }}>{m.change}</small>
            </div>
          </article>
        ))}
      </div>

      {/* Charts row */}
      <div className="kf-two-col">
        {/* Line chart */}
        <section className="kf-card kf-chart">
          <div className="kf-card-head">
            <h2>Donations Over Time</h2>
            <span style={{ color: 'var(--t3)', fontSize: 13 }}>Last 8 weeks</span>
          </div>
          <WeeklyLineChart points={weekPoints} />
        </section>
        {/* Donut */}
        <section className="kf-card kf-donut-card">
          <div className="kf-card-head"><h2>Donations by Status</h2></div>
          <SourceDonut sources={sources} total={totalStr} />
        </section>
      </div>

      {/* Bottom section */}
      <div className="kf-three-col">
        {/* Top Campaigns */}
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head"><h2>Top Campaigns</h2></div>
          <div>
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #eef0f7' }}>
                <div>
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <StatusPill>{c.status}</StatusPill>
                    <strong style={{ fontSize: 13, fontWeight: 650 }}>{c.title}</strong>
                  </div>
                  <small style={{ color: 'var(--t3)', fontSize: 11 }}>Goal: {c.goal}</small>
                </div>
                <b style={{ fontSize: 15, fontWeight: 700 }}>{c.raised}</b>
              </div>
            ))}
          </div>
          {campaigns.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--t3)', padding: '20px', fontSize: 13 }}>No campaigns yet</p>
          )}
        </section>

        {/* Recent Donations */}
        <section className="kf-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head"><h2>Recent Donations</h2></div>
          <div>
            {donations.slice(0, 5).map((d) => (
              <div key={d.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #eef0f7' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #f59e0b)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {d.donor.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{d.donor}</strong>
                  <small style={{ color: 'var(--t3)', fontSize: 11 }}>{d.campaign} · {d.date}</small>
                </div>
                <b style={{ fontSize: 14, fontWeight: 700 }}>{d.amount}</b>
              </div>
            ))}
          </div>
          {donations.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--t3)', padding: '20px', fontSize: 13 }}>No donations yet</p>
          )}
        </section>

        {/* System Health */}
        <section className="kf-card">
          <div className="kf-card-head"><h2>System Health</h2></div>
          <div style={{ padding: '0 20px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            {services.map((s) => (
              <div key={s.name} style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--s2)' }}>
                <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.status === 'Operational' ? '#19b86a' : s.status === 'Degraded' ? '#f59e0b' : s.status === 'Unknown' ? 'var(--t3)' : '#ef4444' }} />
                  <span style={{ fontSize: 13, fontWeight: 650 }}>{s.name}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: s.status === 'Operational' ? 'var(--green-text)' : s.status === 'Degraded' ? 'var(--orange-text)' : s.status === 'Unknown' ? 'var(--t3)' : 'var(--red-text)' }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
