'use client';

import type React from 'react';
import { useState, useTransition } from 'react';
import { KFIcon } from '../../../../components/CharitMeApp';

export type SettingCategory = {
  key: string;
  label: string;
  icon: string;
  description: string;
};

export type PlatformSettings = {
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
  brandPrimaryColor: string;
  brandAccentColor: string;
  logoUrl: string;
  emailFromName: string;
  emailFromAddress: string;
  donationFeePercent: number;
  platformFeePercent: number;
  stripeLiveMode: boolean;
  notifyAdminOnDonation: boolean;
  notifyCampaignApproval: boolean;
  requireMfaForAdmins: boolean;
  sessionTimeoutMinutes: number;
  googleOAuthEnabled: boolean;
  stripeConnectEnabled: boolean;
  maxUploadMb: number;
  auditRetentionDays: number;
};

export type OverviewStats = {
  platformStatus: string;
  categoriesCount: number;
  configurations: number;
  integrations: number;
};

type Props = {
  categories: SettingCategory[];
  settings: PlatformSettings;
  overview: OverviewStats;
};

const fieldStyle: React.CSSProperties = { height: 44, border: '1px solid #dfe3ee', borderRadius: 8, padding: '0 14px', fontSize: 14, background: '#fff' };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, fontWeight: 850, color: '#26335c' };

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      style={{ display: 'inline-flex', width: 44, height: 24, borderRadius: 999, background: value ? '#6c35ff' : '#e0e4ef', border: 'none', cursor: 'pointer', padding: 3, alignItems: 'center', justifyContent: value ? 'flex-end' : 'flex-start' }}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', display: 'block' }} />
    </button>
  );
}

function SettingToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid #eef0f7', borderRadius: 10 }}>
      <div>
        <strong style={{ display: 'block', fontSize: 14, fontWeight: 850 }}>{title}</strong>
        <small style={{ color: '#67718e', fontSize: 12 }}>{description}</small>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

export default function SettingsClient({ categories, settings: initialSettings, overview }: Props) {
  const [activeCategory, setActiveCategory] = useState('General');
  const [settings, setSettings] = useState(initialSettings);
  const [notice, setNotice] = useState('');
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function buildPayload(): { category: string; settings: Record<string, unknown> } {
    const cat = activeCategory;
    if (cat === 'General') return { category: 'general', settings: { platformName: settings.platformName, tagline: settings.tagline, supportEmail: settings.supportEmail, supportPhone: settings.supportPhone, timezone: settings.timezone } };
    if (cat === 'Branding') return { category: 'general', settings: { logoUrl: settings.logoUrl, primaryColor: settings.brandPrimaryColor, accentColor: settings.brandAccentColor, platformName: settings.platformName } };
    if (cat === 'Email') return { category: 'email', settings: { fromName: settings.emailFromName, fromEmail: settings.emailFromAddress, emailVerification: settings.emailVerification, campaignApproval: settings.notifyCampaignApproval } };
    if (cat === 'Payment') return { category: 'payment', settings: { stripeLive: settings.stripeLiveMode, platformFeePct: settings.platformFeePercent, donationFeePct: settings.donationFeePercent, stripeConnect: settings.stripeConnectEnabled, currency: settings.currency } };
    if (cat === 'Notifications') return { category: 'notifications', settings: { emailEnabled: settings.notifyAdminOnDonation, campaignApproval: settings.notifyCampaignApproval } };
    if (cat === 'Security') return { category: 'security', settings: { requireMfa: settings.requireMfaForAdmins, sessionTimeoutMinutes: settings.sessionTimeoutMinutes, googleOAuth: settings.googleOAuthEnabled, allowNewRegistrations: settings.allowNewRegistrations } };
    if (cat === 'Integrations') return { category: 'integrations', settings: { googleAnalyticsEnabled: settings.googleOAuthEnabled, stripeConnect: settings.stripeConnectEnabled } };
    // Advanced
    return { category: 'maintenance', settings: { maintenanceMode: settings.maintenanceMode, maxUploadMb: settings.maxUploadMb, logRetentionDays: settings.auditRetentionDays } };
  }

  function handleSave() {
    setNotice('');
    startTransition(async () => {
      const payload = buildPayload();
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(result.error ?? 'Settings could not be saved.');
        return;
      }
      setNotice('Settings saved to production configuration.');
      setTimeout(() => setNotice(''), 2500);
    });
  }

  function renderDetailPanel() {
    if (activeCategory === 'General') {
      return (
        <>
          <Panel title="Platform Information">
            <Field label="Platform Name"><input value={settings.platformName} onChange={e => set('platformName', e.target.value)} style={fieldStyle} /></Field>
            <Field label="Tagline"><input value={settings.tagline} onChange={e => set('tagline', e.target.value)} style={fieldStyle} /></Field>
            <Field label="Support Email"><input type="email" value={settings.supportEmail} onChange={e => set('supportEmail', e.target.value)} style={fieldStyle} /></Field>
            <Field label="Support Phone"><input value={settings.supportPhone} onChange={e => set('supportPhone', e.target.value)} style={fieldStyle} /></Field>
          </Panel>
          <Panel title="Localization">
            <Field label="Default Timezone"><select value={settings.timezone} onChange={e => set('timezone', e.target.value)} style={fieldStyle}><option value="America/New_York">Eastern Time (ET)</option><option value="America/Chicago">Central Time (CT)</option><option value="America/Denver">Mountain Time (MT)</option><option value="America/Los_Angeles">Pacific Time (PT)</option><option value="UTC">UTC</option></select></Field>
            <Field label="Date Format"><select value={settings.dateFormat} onChange={e => set('dateFormat', e.target.value)} style={fieldStyle}><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></Field>
            <Field label="Currency"><select value={settings.currency} onChange={e => set('currency', e.target.value)} style={fieldStyle}><option value="USD">USD - US Dollar</option><option value="EUR">EUR - Euro</option><option value="GBP">GBP - British Pound</option><option value="CAD">CAD - Canadian Dollar</option></select></Field>
            <Field label="Items Per Page"><select value={settings.itemsPerPage} onChange={e => set('itemsPerPage', Number(e.target.value))} style={fieldStyle}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></Field>
          </Panel>
        </>
      );
    }

    if (activeCategory === 'Branding') {
      return (
        <Panel title="Brand Controls">
          <Field label="Primary Color"><input type="color" value={settings.brandPrimaryColor} onChange={e => set('brandPrimaryColor', e.target.value)} style={{ ...fieldStyle, padding: 6 }} /></Field>
          <Field label="Accent Color"><input type="color" value={settings.brandAccentColor} onChange={e => set('brandAccentColor', e.target.value)} style={{ ...fieldStyle, padding: 6 }} /></Field>
          <Field label="Logo URL"><input value={settings.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://..." style={fieldStyle} /></Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, border: '1px solid #eef0f7', borderRadius: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, background: settings.brandPrimaryColor }} />
            <span style={{ width: 36, height: 36, borderRadius: 12, background: settings.brandAccentColor }} />
            <strong style={{ color: '#101842' }}>{settings.platformName}</strong>
          </div>
        </Panel>
      );
    }

    if (activeCategory === 'Email') {
      return (
        <Panel title="Email Delivery">
          <Field label="From Name"><input value={settings.emailFromName} onChange={e => set('emailFromName', e.target.value)} style={fieldStyle} /></Field>
          <Field label="From Address"><input type="email" value={settings.emailFromAddress} onChange={e => set('emailFromAddress', e.target.value)} style={fieldStyle} /></Field>
          <SettingToggle title="Require Email Verification" description="New accounts must verify email before fundraising." value={settings.emailVerification} onChange={v => set('emailVerification', v)} />
          <SettingToggle title="Campaign Approval Emails" description="Notify organizers when admin review changes a campaign." value={settings.notifyCampaignApproval} onChange={v => set('notifyCampaignApproval', v)} />
        </Panel>
      );
    }

    if (activeCategory === 'Payment') {
      return (
        <Panel title="Payment Controls">
          <Field label="Donation Fee Percent"><input type="number" min={0} step={0.1} value={settings.donationFeePercent} onChange={e => set('donationFeePercent', Number(e.target.value))} style={fieldStyle} /></Field>
          <Field label="Platform Fee Percent"><input type="number" min={0} step={0.1} value={settings.platformFeePercent} onChange={e => set('platformFeePercent', Number(e.target.value))} style={fieldStyle} /></Field>
          <SettingToggle title="Stripe Live Mode" description="Use live Stripe credentials for checkout and payouts." value={settings.stripeLiveMode} onChange={v => set('stripeLiveMode', v)} />
          <SettingToggle title="Stripe Connect" description="Allow organizers to connect payout accounts." value={settings.stripeConnectEnabled} onChange={v => set('stripeConnectEnabled', v)} />
        </Panel>
      );
    }

    if (activeCategory === 'Notifications') {
      return (
        <Panel title="Notification Rules">
          <SettingToggle title="Admin Donation Alerts" description="Send admin alerts when donations are completed." value={settings.notifyAdminOnDonation} onChange={v => set('notifyAdminOnDonation', v)} />
          <SettingToggle title="Campaign Review Alerts" description="Notify admins when campaigns need review." value={settings.notifyCampaignApproval} onChange={v => set('notifyCampaignApproval', v)} />
        </Panel>
      );
    }

    if (activeCategory === 'Security') {
      return (
        <Panel title="Security Policy">
          <SettingToggle title="Require MFA For Admins" description="Admins must use stronger authentication for sensitive tools." value={settings.requireMfaForAdmins} onChange={v => set('requireMfaForAdmins', v)} />
          <Field label="Session Timeout Minutes"><input type="number" min={5} value={settings.sessionTimeoutMinutes} onChange={e => set('sessionTimeoutMinutes', Number(e.target.value))} style={fieldStyle} /></Field>
          <SettingToggle title="Google OAuth" description="Allow Google sign-in for supported accounts." value={settings.googleOAuthEnabled} onChange={v => set('googleOAuthEnabled', v)} />
          <SettingToggle title="New Registrations" description="Allow new users to create accounts." value={settings.allowNewRegistrations} onChange={v => set('allowNewRegistrations', v)} />
        </Panel>
      );
    }

    if (activeCategory === 'Integrations') {
      return (
        <Panel title="Integration Switches">
          <SettingToggle title="Google OAuth" description="Enable Google as an auth provider." value={settings.googleOAuthEnabled} onChange={v => set('googleOAuthEnabled', v)} />
          <SettingToggle title="Stripe Connect" description="Enable connected accounts and payout onboarding." value={settings.stripeConnectEnabled} onChange={v => set('stripeConnectEnabled', v)} />
          <p style={{ margin: 0, color: '#67718e', fontWeight: 750 }}>Connected integrations: {overview.integrations.toLocaleString()}</p>
        </Panel>
      );
    }

    return (
      <Panel title="Advanced Limits">
        <SettingToggle title="Maintenance Mode" description="Temporarily prevent normal app usage during maintenance." value={settings.maintenanceMode} onChange={v => set('maintenanceMode', v)} />
        <Field label="Max Upload MB"><input type="number" min={1} value={settings.maxUploadMb} onChange={e => set('maxUploadMb', Number(e.target.value))} style={fieldStyle} /></Field>
        <Field label="Audit Retention Days"><input type="number" min={30} value={settings.auditRetentionDays} onChange={e => set('auditRetentionDays', Number(e.target.value))} style={fieldStyle} /></Field>
      </Panel>
    );
  }

  return (
    <div className="kf-admin-dash">
      <div className="kf-metrics">
        {[
          { label: 'Platform Status', value: overview.platformStatus, icon: 'check', tone: 'green' as const },
          { label: 'Categories', value: overview.categoriesCount.toString(), icon: 'stack', tone: 'violet' as const },
          { label: 'Configurations', value: overview.configurations.toString(), icon: 'gear', tone: 'blue' as const },
          { label: 'Integrations', value: overview.integrations.toString(), icon: 'link', tone: 'orange' as const },
        ].map(m => (
          <article key={m.label} className="kf-card kf-metric">
            <div className={`kf-square ${m.tone}`}><KFIcon name={m.icon} /></div>
            <div><span>{m.label}</span><strong>{m.value}</strong></div>
          </article>
        ))}
      </div>

      <div className="kf-settings-layout" style={{ alignItems: 'start' }}>
        <nav className="kf-settings-nav">
          <h3 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 950, textTransform: 'uppercase', color: '#4b5676', letterSpacing: '0.05em' }}>Settings</h3>
          {categories.map(cat => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.label)} style={{ minHeight: 46, display: 'flex', alignItems: 'center', gap: 13, padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, textAlign: 'left', width: '100%', background: activeCategory === cat.label ? '#f0eaff' : 'transparent', color: activeCategory === cat.label ? '#551cf2' : '#18234d' }}>
              <KFIcon name={cat.icon} />
              <div><span>{cat.label}</span><small style={{ display: 'block', fontSize: 11, fontWeight: 650, color: activeCategory === cat.label ? '#7c50f5' : '#67718e', marginTop: 2 }}>{cat.description}</small></div>
            </button>
          ))}
        </nav>

        <section className="kf-card kf-form-card" style={{ overflow: 'hidden' }}>
          <div className="kf-card-head">
            <div>
              <h2>{activeCategory}</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#4b5676' }}>{categories.find(c => c.label === activeCategory)?.description ?? ''}</p>
            </div>
          </div>
          {renderDetailPanel()}
          <div style={{ padding: '16px 26px', borderTop: '1px solid #eef0f7', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            {notice && <span style={{ color: notice.includes('could not') ? '#e11d48' : '#079447', fontSize: 13, fontWeight: 850, alignSelf: 'center' }}>{notice}</span>}
            <button className="kf-outline" style={{ height: 44, padding: '0 20px' }} onClick={() => setSettings(initialSettings)} disabled={isPending}>Reset</button>
            <button className="kf-primary" style={{ height: 44, padding: '0 24px' }} onClick={handleSave} disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={labelStyle}>{label}{children}</label>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '22px 26px', borderTop: '1px solid #eef0f7' }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 950 }}>{title}</h3>
      <div className="kf-form-grid">{children}</div>
    </div>
  );
}
