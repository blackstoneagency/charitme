'use client';

import { useState } from 'react';
import { KFIcon, StatusPill } from '../../../../components/KindFundApp';

export type SystemCategory = {
  key: string;
  label: string;
  icon: string;
  description: string;
};

export type RecentActivity = {
  id: string;
  action: string;
  category: string;
  time: string;
  status: string;
};

export type SystemOverview = {
  healthStatus: string;
  servicesOnline: number;
  integrationsActive: number;
  scheduledJobs: number;
  errorRate: string;
};

type Props = {
  categories: SystemCategory[];
  overview: SystemOverview;
  recentActivity: RecentActivity[];
};

export default function SystemClient({ categories, overview, recentActivity }: Props) {
  const [activeCategory, setActiveCategory] = useState('General');

  const overviewMetrics = [
    { label: 'System Health', value: overview.healthStatus, icon: 'check', tone: 'green' as const },
    { label: 'Services Online', value: String(overview.servicesOnline), icon: 'link', tone: 'violet' as const },
    { label: 'Active Integrations', value: String(overview.integrationsActive), icon: 'stack', tone: 'blue' as const },
    { label: 'Error Rate', value: overview.errorRate, icon: overview.errorRate === '0%' ? 'check' : 'audit', tone: overview.errorRate === '0%' ? 'green' as const : 'orange' as const },
  ];

  const resourceUsage = [
    { label: 'CPU Usage', value: 32, color: '#6c35ff' },
    { label: 'Memory', value: 48, color: '#19b86a' },
    { label: 'Disk Space', value: 26, color: '#2f80ed' },
  ];

  function renderCategoryDetail() {
    if (activeCategory !== 'General') {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: '#67718e', fontSize: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0eaff', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: '#551cf2' }}>
            <KFIcon name={categories.find(c => c.label === activeCategory)?.icon ?? 'gear'} />
          </div>
          <strong style={{ display: 'block', fontSize: 16, fontWeight: 950, color: '#0f1238', marginBottom: 8 }}>{activeCategory}</strong>
          <p style={{ margin: 0 }}>{categories.find(c => c.label === activeCategory)?.description}</p>
          <p style={{ margin: '16px 0 0', fontSize: 12, color: '#8c95b2' }}>Configuration panel coming soon.</p>
        </div>
      );
    }

    return (
      <div>
        <div style={{ padding: '22px 26px', borderTop: '1px solid #eef0f7' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 950 }}>General System Settings</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              ['Environment', 'Production'],
              ['Version', '1.0.0'],
              ['Node.js', '20.x'],
              ['Next.js', '14.x'],
              ['Database', 'Supabase PostgreSQL'],
              ['Cache TTL', '3600s'],
            ].map(([label, val]) => (
              <div key={label} style={{ padding: '14px 16px', border: '1px solid #eef0f7', borderRadius: 9, background: '#fafbff' }}>
                <small style={{ display: 'block', color: '#67718e', fontSize: 11, fontWeight: 750 }}>{label}</small>
                <strong style={{ display: 'block', fontSize: 14, fontWeight: 850, marginTop: 4 }}>{val}</strong>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '22px 26px', borderTop: '1px solid #eef0f7' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 950 }}>Resource Usage</h3>
          {resourceUsage.map(r => (
            <div key={r.label} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 750 }}>{r.label}</span>
                <strong style={{ fontSize: 13, fontWeight: 950 }}>{r.value}%</strong>
              </div>
              <div style={{ height: 8, background: '#eee8ff', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.value}%`, background: r.color, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 32px 32px', display: 'grid', gap: 22 }}>
      {/* Overview KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        {overviewMetrics.map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}><KFIcon name={m.icon} /></div>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
            </div>
          </article>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Category nav */}
        <nav className="kf-settings-nav">
          <h3 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 950, textTransform: 'uppercase', color: '#4b5676', letterSpacing: '0.05em' }}>System</h3>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.label)}
              style={{
                minHeight: 46, display: 'flex', alignItems: 'center', gap: 13,
                padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: 800, fontSize: 14, textAlign: 'left', width: '100%',
                background: activeCategory === cat.label ? '#f0eaff' : 'transparent',
                color: activeCategory === cat.label ? '#551cf2' : '#18234d',
              }}
            >
              <KFIcon name={cat.icon} />
              <div>
                <span>{cat.label}</span>
                <small style={{ display: 'block', fontSize: 11, fontWeight: 650, color: activeCategory === cat.label ? '#7c50f5' : '#67718e', marginTop: 2 }}>{cat.description}</small>
              </div>
            </button>
          ))}
        </nav>

        {/* Right panel: detail + activity */}
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Category detail */}
          <section className="kf-card" style={{ overflow: 'hidden' }}>
            <div className="kf-card-head">
              <h2>{activeCategory}</h2>
            </div>
            {renderCategoryDetail()}
          </section>

          {/* Recent system activity */}
          <section className="kf-card" style={{ overflow: 'hidden' }}>
            <div className="kf-card-head">
              <h2>Recent System Activity</h2>
              <span style={{ color: '#4b5676', fontSize: 13 }}>Last 100 webhook events</span>
            </div>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px', gap: 12, padding: '8px 20px', background: '#f8f9fc', borderBottom: '1px solid #eef0f7', fontSize: 11, fontWeight: 950, color: '#4b5676', textTransform: 'uppercase' }}>
              <span>Action</span>
              <span>Category</span>
              <span>Time</span>
              <span>Status</span>
            </div>
            {recentActivity.slice(0, 8).map(ev => (
              <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px', gap: 12, padding: '12px 20px', borderBottom: '1px solid #eef0f7', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 750 }}>{ev.action}</span>
                <span style={{ fontSize: 12, color: '#67718e' }}>{ev.category}</span>
                <span style={{ fontSize: 11, color: '#8c95b2' }}>{ev.time}</span>
                <StatusPill>{ev.status}</StatusPill>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#67718e', fontSize: 13 }}>No recent activity</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
