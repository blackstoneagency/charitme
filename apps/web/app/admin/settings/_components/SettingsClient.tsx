'use client';

import { useState } from 'react';
import { KFIcon } from '../../../../components/KindFundApp';

export type SettingCategory = {
  key: string;
  label: string;
  icon: string;
  description: string;
};

export type GeneralSettings = {
  platformName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  itemsPerPage: number;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  emailVerification: boolean;
};

export type OverviewStats = {
  platformStatus: string;
  categoriesCount: number;
  configurations: number;
  integrations: number;
};

type Props = {
  categories: SettingCategory[];
  settings: GeneralSettings;
  overview: OverviewStats;
};

const TOGGLE_STYLE_ON: React.CSSProperties = {
  display: 'inline-flex', width: 44, height: 24, borderRadius: 999, background: '#6c35ff', border: 'none', cursor: 'pointer', padding: 3, alignItems: 'center', justifyContent: 'flex-end',
};
const TOGGLE_STYLE_OFF: React.CSSProperties = {
  ...{} as React.CSSProperties,
  display: 'inline-flex', width: 44, height: 24, borderRadius: 999, background: '#e0e4ef', border: 'none', cursor: 'pointer', padding: 3, alignItems: 'center', justifyContent: 'flex-start',
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      style={value ? TOGGLE_STYLE_ON : TOGGLE_STYLE_OFF}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', display: 'block' }} />
    </button>
  );
}

export default function SettingsClient({ categories, settings: initialSettings, overview }: Props) {
  const [activeCategory, setActiveCategory] = useState('General');
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function renderDetailPanel() {
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
        {/* Platform info */}
        <div style={{ padding: '22px 26px', borderTop: '1px solid #eef0f7' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 950 }}>Platform Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Platform Name
              <input
                value={settings.platformName}
                onChange={e => setSettings(s => ({ ...s, platformName: e.target.value }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Tagline
              <input
                value={settings.tagline}
                onChange={e => setSettings(s => ({ ...s, tagline: e.target.value }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Support Email
              <input
                value={settings.supportEmail}
                onChange={e => setSettings(s => ({ ...s, supportEmail: e.target.value }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Support Phone
              <input
                value={settings.supportPhone}
                onChange={e => setSettings(s => ({ ...s, supportPhone: e.target.value }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14 }}
              />
            </label>
          </div>
        </div>

        {/* Localization */}
        <div style={{ padding: '22px 26px', borderTop: '1px solid #eef0f7' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 950 }}>Localization</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Default Timezone
              <select
                value={settings.timezone}
                onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14, background: '#fff' }}
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="UTC">UTC</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Date Format
              <select
                value={settings.dateFormat}
                onChange={e => setSettings(s => ({ ...s, dateFormat: e.target.value }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14, background: '#fff' }}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Currency
              <select
                value={settings.currency}
                onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14, background: '#fff' }}
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="CAD">CAD — Canadian Dollar</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' }}>
              Items Per Page
              <select
                value={settings.itemsPerPage}
                onChange={e => setSettings(s => ({ ...s, itemsPerPage: parseInt(e.target.value) }))}
                style={{ height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14, background: '#fff' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </div>

        {/* Site settings */}
        <div style={{ padding: '22px 26px', borderTop: '1px solid #eef0f7' }}>
          <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 950 }}>Site Settings</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {([
              ['maintenanceMode', 'Maintenance Mode', 'Temporarily disable the site for maintenance'],
              ['allowNewRegistrations', 'Allow New Registrations', 'Allow new users to sign up'],
              ['emailVerification', 'Email Verification', 'Require email verification for new accounts'],
            ] as [keyof GeneralSettings, string, string][]).map(([key, label, desc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: '1px solid #eef0f7', borderRadius: 10 }}>
                <div>
                  <strong style={{ display: 'block', fontSize: 14, fontWeight: 850 }}>{label}</strong>
                  <small style={{ color: '#67718e', fontSize: 12 }}>{desc}</small>
                </div>
                <Toggle
                  value={settings[key] as boolean}
                  onChange={v => setSettings(s => ({ ...s, [key]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div style={{ padding: '16px 26px', borderTop: '1px solid #eef0f7', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {saved && <span style={{ color: '#079447', fontSize: 13, fontWeight: 850, alignSelf: 'center' }}>Settings saved!</span>}
          <button className="kf-outline" style={{ height: 44, padding: '0 20px' }} onClick={() => setSettings(initialSettings)}>
            Reset
          </button>
          <button className="kf-primary" style={{ height: 44, padding: '0 24px' }} onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 32px 32px', display: 'grid', gap: 22 }}>
      {/* Overview stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        {[
          { label: 'Platform Status', value: overview.platformStatus, icon: 'check', tone: 'green' as const },
          { label: 'Categories', value: overview.categoriesCount.toString(), icon: 'stack', tone: 'violet' as const },
          { label: 'Configurations', value: overview.configurations.toString(), icon: 'gear', tone: 'blue' as const },
          { label: 'Integrations', value: overview.integrations.toString(), icon: 'link', tone: 'orange' as const },
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

      {/* Main settings layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Category nav */}
        <nav className="kf-settings-nav">
          <h3 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 950, textTransform: 'uppercase', color: '#4b5676', letterSpacing: '0.05em' }}>Settings</h3>
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

        {/* Detail panel */}
        <section className="kf-card kf-form-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head">
            <div>
              <h2>{activeCategory}</h2>
              <p className="kf-card-head" style={{ margin: 0, padding: 0, fontSize: 13, color: '#4b5676' }}>
                {categories.find(c => c.label === activeCategory)?.description ?? ''}
              </p>
            </div>
          </div>
          {renderDetailPanel()}
        </section>
      </div>
    </div>
  );
}
