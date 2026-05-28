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

  type FieldDef = { label: string; type: 'text' | 'password' | 'number' | 'select' | 'toggle' | 'textarea'; placeholder?: string; options?: string[]; defaultValue?: string; hint?: string };
  type SectionDef = { title: string; fields: FieldDef[] };

  function getCategoryConfig(cat: string): SectionDef[] {
    switch (cat) {
      case 'Security':
        return [
          {
            title: 'Authentication',
            fields: [
              { label: 'Session Timeout (minutes)', type: 'number', placeholder: '60', defaultValue: '60', hint: 'How long before inactive sessions expire' },
              { label: 'Max Login Attempts', type: 'number', placeholder: '5', defaultValue: '5', hint: 'Lockout after this many failed logins' },
              { label: 'Two-Factor Authentication', type: 'toggle', defaultValue: 'true', hint: 'Require 2FA for all admin accounts' },
              { label: 'Password Min Length', type: 'number', placeholder: '12', defaultValue: '12' },
            ],
          },
          {
            title: 'Access Control',
            fields: [
              { label: 'Admin IP Allowlist', type: 'textarea', placeholder: '192.168.1.0/24\n10.0.0.0/8', hint: 'One CIDR range per line. Leave empty to allow all.' },
              { label: 'Force HTTPS', type: 'toggle', defaultValue: 'true' },
              { label: 'HSTS Max Age (seconds)', type: 'number', placeholder: '31536000', defaultValue: '31536000' },
            ],
          },
        ];
      case 'Email':
        return [
          {
            title: 'SMTP Server',
            fields: [
              { label: 'SMTP Host', type: 'text', placeholder: 'smtp.sendgrid.net', hint: 'Outbound mail server hostname' },
              { label: 'SMTP Port', type: 'number', placeholder: '587', defaultValue: '587' },
              { label: 'SMTP Username', type: 'text', placeholder: 'apikey' },
              { label: 'SMTP Password', type: 'password', placeholder: '••••••••••••' },
              { label: 'Encryption', type: 'select', options: ['TLS', 'SSL', 'None'], defaultValue: 'TLS' },
            ],
          },
          {
            title: 'Sender Identity',
            fields: [
              { label: 'From Name', type: 'text', placeholder: 'KindFund', defaultValue: 'KindFund' },
              { label: 'From Email', type: 'text', placeholder: 'noreply@kindfund.org' },
              { label: 'Reply-To Email', type: 'text', placeholder: 'support@kindfund.org' },
            ],
          },
        ];
      case 'Payment':
        return [
          {
            title: 'Stripe',
            fields: [
              { label: 'Stripe Publishable Key', type: 'text', placeholder: 'pk_live_…', hint: 'Baked into the client bundle at build time' },
              { label: 'Stripe Secret Key', type: 'password', placeholder: 'sk_live_…' },
              { label: 'Webhook Signing Secret', type: 'password', placeholder: 'whsec_…' },
            ],
          },
          {
            title: 'Fees & Limits',
            fields: [
              { label: 'Platform Fee (%)', type: 'number', placeholder: '3', defaultValue: '3', hint: 'Percentage charged on each successful donation' },
              { label: 'Minimum Donation (cents)', type: 'number', placeholder: '100', defaultValue: '100', hint: 'e.g. 100 = $1.00' },
              { label: 'Maximum Donation (cents)', type: 'number', placeholder: '1000000', defaultValue: '1000000' },
              { label: 'Currency', type: 'select', options: ['USD', 'CAD', 'GBP', 'EUR', 'AUD'], defaultValue: 'USD' },
            ],
          },
        ];
      case 'Integrations':
        return [
          {
            title: 'Webhook Endpoints',
            fields: [
              { label: 'Donation Success Webhook URL', type: 'text', placeholder: 'https://your-app.com/hooks/donation', hint: 'POST request on every completed donation' },
              { label: 'Campaign Created Webhook URL', type: 'text', placeholder: 'https://your-app.com/hooks/campaign' },
              { label: 'Refund Webhook URL', type: 'text', placeholder: 'https://your-app.com/hooks/refund' },
              { label: 'Webhook Secret', type: 'password', placeholder: 'whsec_custom_…', hint: 'HMAC-SHA256 signing key for outbound webhooks' },
            ],
          },
          {
            title: 'Third-Party Services',
            fields: [
              { label: 'Google Analytics ID', type: 'text', placeholder: 'G-XXXXXXXXXX' },
              { label: 'Intercom App ID', type: 'text', placeholder: 'abc12345' },
              { label: 'Slack Webhook URL', type: 'text', placeholder: 'https://hooks.slack.com/services/…', hint: 'Post admin alerts to Slack' },
            ],
          },
        ];
      case 'Notifications':
        return [
          {
            title: 'In-App Notifications',
            fields: [
              { label: 'New Donation Alerts', type: 'toggle', defaultValue: 'true' },
              { label: 'Campaign Milestone Alerts', type: 'toggle', defaultValue: 'true' },
              { label: 'Failed Payment Alerts', type: 'toggle', defaultValue: 'true' },
              { label: 'New User Signup Alerts', type: 'toggle', defaultValue: 'false' },
            ],
          },
          {
            title: 'Email Notifications',
            fields: [
              { label: 'Admin Digest Frequency', type: 'select', options: ['Real-time', 'Hourly', 'Daily', 'Weekly', 'Disabled'], defaultValue: 'Daily' },
              { label: 'Digest Recipient Emails', type: 'textarea', placeholder: 'admin@example.com\nops@example.com', hint: 'One email per line' },
            ],
          },
        ];
      case 'Storage':
        return [
          {
            title: 'File Storage',
            fields: [
              { label: 'Storage Provider', type: 'select', options: ['Supabase Storage', 'AWS S3', 'Cloudflare R2'], defaultValue: 'Supabase Storage' },
              { label: 'Bucket Name', type: 'text', placeholder: 'kindfund-assets' },
              { label: 'Max Upload Size (MB)', type: 'number', placeholder: '10', defaultValue: '10' },
              { label: 'Allowed File Types', type: 'text', placeholder: 'jpg,jpeg,png,gif,webp,pdf', defaultValue: 'jpg,jpeg,png,gif,webp,pdf' },
            ],
          },
          {
            title: 'CDN',
            fields: [
              { label: 'CDN Base URL', type: 'text', placeholder: 'https://cdn.kindfund.org', hint: 'Leave empty to use Supabase Storage URLs' },
              { label: 'Image Optimization', type: 'toggle', defaultValue: 'true', hint: 'Auto-compress uploaded images via Next.js Image' },
            ],
          },
        ];
      case 'System Maintenance':
        return [
          {
            title: 'Backups',
            fields: [
              { label: 'Automatic Backups', type: 'toggle', defaultValue: 'true' },
              { label: 'Backup Frequency', type: 'select', options: ['Hourly', 'Daily', 'Weekly'], defaultValue: 'Daily' },
              { label: 'Backup Retention (days)', type: 'number', placeholder: '30', defaultValue: '30' },
              { label: 'Backup Destination', type: 'text', placeholder: 's3://my-bucket/backups', hint: 'S3-compatible URI for backup exports' },
            ],
          },
          {
            title: 'Maintenance Mode',
            fields: [
              { label: 'Enable Maintenance Mode', type: 'toggle', defaultValue: 'false', hint: 'Shows a maintenance page to all non-admin visitors' },
              { label: 'Maintenance Message', type: 'textarea', placeholder: "We're performing scheduled maintenance. Back soon!", defaultValue: "We're performing scheduled maintenance. Back soon!" },
            ],
          },
        ];
      case 'Feature Flags':
        return [
          {
            title: 'Platform Features',
            fields: [
              { label: 'Recurring Donations', type: 'toggle', defaultValue: 'true', hint: 'Allow donors to set up recurring giving' },
              { label: 'Anonymous Donations', type: 'toggle', defaultValue: 'true' },
              { label: 'Team Fundraising', type: 'toggle', defaultValue: 'true', hint: 'Let organizers create team campaigns' },
              { label: 'Gift Aid (UK)', type: 'toggle', defaultValue: 'false' },
              { label: 'Corporate Matching', type: 'toggle', defaultValue: 'false', hint: 'Enable employer match contribution prompts' },
              { label: 'Crypto Donations (beta)', type: 'toggle', defaultValue: 'false' },
            ],
          },
        ];
      case 'Advanced':
        return [
          {
            title: 'Performance',
            fields: [
              { label: 'API Rate Limit (req/min)', type: 'number', placeholder: '120', defaultValue: '120' },
              { label: 'Cache TTL (seconds)', type: 'number', placeholder: '3600', defaultValue: '3600', hint: 'Server-side cache lifetime for public pages' },
              { label: 'Database Pool Size', type: 'number', placeholder: '10', defaultValue: '10' },
            ],
          },
          {
            title: 'Debugging',
            fields: [
              { label: 'Verbose Logging', type: 'toggle', defaultValue: 'false', hint: 'Log all API requests to stdout — not for production' },
              { label: 'Error Reporting DSN', type: 'text', placeholder: 'https://…@sentry.io/12345', hint: 'Sentry or compatible DSN for error tracking' },
            ],
          },
        ];
      default:
        return [];
    }
  }

  function renderCategoryDetail() {
    if (activeCategory !== 'General') {
      const sections = getCategoryConfig(activeCategory);
      return (
        <div style={{ padding: '22px 26px', display: 'grid', gap: 28 }}>
          {sections.map(section => (
            <div key={section.title}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 950, color: '#0f1238' }}>{section.title}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {section.fields.map(field => (
                  <div key={field.label} style={{ gridColumn: field.type === 'textarea' ? 'span 2' : 'span 1' }}>
                    <label style={{ display: 'grid', gap: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 850, color: '#26335c' }}>{field.label}</span>
                      {field.hint && <span style={{ fontSize: 11, color: '#8c9ab5', marginTop: -2 }}>{field.hint}</span>}
                      {field.type === 'toggle' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                          <div style={{ width: 40, height: 22, borderRadius: 99, background: field.defaultValue === 'true' ? '#6c35ff' : '#d1d5e8', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
                            <div style={{ position: 'absolute', top: 3, left: field.defaultValue === 'true' ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                          </div>
                          <span style={{ fontSize: 12, color: field.defaultValue === 'true' ? '#551cf2' : '#66708d', fontWeight: 750 }}>{field.defaultValue === 'true' ? 'Enabled' : 'Disabled'}</span>
                        </div>
                      ) : field.type === 'select' ? (
                        <select defaultValue={field.defaultValue} style={{ height: 40, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 12px', fontSize: 13, fontWeight: 750, color: '#101842', background: '#fff', marginTop: 2 }}>
                          {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea defaultValue={field.defaultValue ?? ''} placeholder={field.placeholder} rows={3} style={{ border: '1px solid #dfe3ee', borderRadius: 9, padding: '10px 12px', fontSize: 13, fontWeight: 750, color: '#101842', resize: 'vertical', fontFamily: 'inherit', marginTop: 2 }} />
                      ) : (
                        <input type={field.type} defaultValue={field.defaultValue ?? ''} placeholder={field.placeholder} style={{ height: 40, border: '1px solid #dfe3ee', borderRadius: 9, padding: '0 12px', fontSize: 13, fontWeight: 750, color: '#101842', marginTop: 2 }} />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" style={{ height: 40, padding: '0 20px', border: 0, borderRadius: 9, background: 'linear-gradient(135deg, #6c35ff, #551cf2)', color: '#fff', fontSize: 13, fontWeight: 950, cursor: 'pointer', boxShadow: '0 8px 18px rgba(85,28,242,.18)' }}
              onClick={() => alert(`${activeCategory} settings saved`)}>
              Save Changes
            </button>
            <button type="button" style={{ height: 40, padding: '0 16px', border: '1px solid #e0e4ef', borderRadius: 9, background: '#fff', color: '#26335c', fontSize: 13, fontWeight: 750, cursor: 'pointer' }}
              onClick={() => {}}>
              Reset to Defaults
            </button>
          </div>
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
