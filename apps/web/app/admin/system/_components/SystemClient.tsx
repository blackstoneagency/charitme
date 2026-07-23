'use client';

import { useState } from 'react';
import { KFIcon, StatusPill } from '../../../../components/CharitMeApp';

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

export type ResourceUsage = {
  label: string;
  value: number;
  color: string;
};

export type AllSettings = {
  general: Record<string, unknown>;
  security: Record<string, unknown>;
  email: Record<string, unknown>;
  payment: Record<string, unknown>;
  integrations: Record<string, unknown>;
  notifications: Record<string, unknown>;
  storage: Record<string, unknown>;
  maintenance: Record<string, unknown>;
  flags: Record<string, unknown>;
  advanced: Record<string, unknown>;
};

type Props = {
  categories: SystemCategory[];
  overview: SystemOverview;
  recentActivity: RecentActivity[];
  resourceUsage: ResourceUsage[];
  initialSettings: AllSettings;
};

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sys-toggle" aria-label="Toggle setting">
      <input aria-label="Toggle setting" type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="sys-toggle-track" />
      <span className="sys-toggle-thumb" />
    </label>
  );
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`sys-field${full ? ' full' : ''}`}>
      <span className="sys-field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

// ─── Category label maps for diff display ─────────────────────────────────────

const LABEL_MAPS: Record<string, Record<string, string>> = {
  general: {
    platformName: 'Platform Name',
    tagline: 'Tagline',
    supportEmail: 'Support Email',
    supportPhone: 'Support Phone',
    timezone: 'Time Zone',
    logoUrl: 'Logo URL',
    primaryColor: 'Primary Color',
  },
  security: {
    passwordPolicy: 'Password Policy',
    twoFactorAuth: 'Two-Factor Auth',
    sessionTimeoutMinutes: 'Session Timeout (min)',
    loginAttemptsAllowed: 'Login Attempts Allowed',
    ipWhitelist: 'IP Whitelist',
  },
  email: {
    fromName: 'From Name',
    fromEmail: 'From Email',
    replyToEmail: 'Reply-To Email',
    emailProvider: 'Email Provider',
    apiKey: 'API Key',
    defaultLanguage: 'Default Language',
    emailFooterText: 'Footer Text',
  },
  payment: {
    stripeLive: 'Stripe Live Mode',
    paypalEnabled: 'PayPal Enabled',
    bankTransferEnabled: 'Bank Transfer Enabled',
    platformFeePct: 'Platform Fee (%)',
    currency: 'Currency',
  },
  integrations: {
    googleAnalyticsEnabled: 'Google Analytics',
    gaId: 'GA Measurement ID',
    mailchimpEnabled: 'Mailchimp',
    mailchimpKey: 'Mailchimp API Key',
    slackEnabled: 'Slack',
    slackWebhook: 'Slack Webhook URL',
    zapierEnabled: 'Zapier',
    webhookUrl: 'Webhook URL',
  },
  notifications: {
    inAppEnabled: 'In-App Notifications',
    emailEnabled: 'Email Notifications',
    pushEnabled: 'Push Notifications',
    smsEnabled: 'SMS Notifications',
    quietHoursStart: 'Quiet Hours Start',
    quietHoursEnd: 'Quiet Hours End',
  },
  storage: {
    cdnProvider: 'CDN Provider',
    cdnUrl: 'CDN URL',
    maxUploadMb: 'Max Upload (MB)',
    allowedFileTypes: 'Allowed File Types',
  },
  maintenance: {
    automatedBackup: 'Automated Backup',
    backupFrequency: 'Backup Frequency',
    backupRetentionDays: 'Backup Retention (days)',
    logRetentionDays: 'Log Retention (days)',
    maintenanceMode: 'Maintenance Mode',
  },
  flags: {
    aiGrowthPlan: 'AI Growth Plan',
    recurringDonations: 'Recurring Donations',
    donorLeaderboard: 'Donor Leaderboard',
    campaignAnalytics: 'Campaign Analytics',
    referralProgram: 'Referral Program',
  },
  advanced: {
    debugMode: 'Debug Mode',
    apiRateLimit: 'API Rate Limit',
    cacheTtlSeconds: 'Cache TTL (s)',
    webhookTimeoutSeconds: 'Webhook Timeout (s)',
    allowNewRegistrations: 'Allow New Registrations',
  },
};

function formatValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Enabled' : 'Disabled';
  if (v === '' || v === null || v === undefined) return '(empty)';
  return String(v);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SystemClient({ categories, overview, recentActivity, resourceUsage, initialSettings }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState<AllSettings>(initialSettings);
  const [draft, setDraft] = useState<AllSettings>(initialSettings);
  const [showReview, setShowReview] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  function setField(category: string, key: string, value: unknown) {
    setDraft(prev => ({
      ...prev,
      [category]: { ...prev[category as keyof AllSettings], [key]: value },
    }));
  }

  const hasChanges = activeCategory
    ? JSON.stringify(savedSettings[activeCategory as keyof AllSettings]) !==
      JSON.stringify(draft[activeCategory as keyof AllSettings])
    : false;

  function computeChanges(category: string): Array<{ key: string; label: string; old: string; new: string }> {
    const labelMap = LABEL_MAPS[category] ?? {};
    const saved = savedSettings[category as keyof AllSettings] ?? {};
    const current = draft[category as keyof AllSettings] ?? {};
    const allKeys = new Set([...Object.keys(saved), ...Object.keys(current)]);
    const result: Array<{ key: string; label: string; old: string; new: string }> = [];
    for (const k of allKeys) {
      if (JSON.stringify(saved[k]) !== JSON.stringify(current[k])) {
        result.push({
          key: k,
          label: labelMap[k] ?? k,
          old: formatValue(saved[k]),
          new: formatValue(current[k]),
        });
      }
    }
    return result;
  }

  async function handleSave() {
    if (!activeCategory) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: activeCategory,
          settings: draft[activeCategory as keyof AllSettings],
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; settings?: Record<string, unknown> };
      if (!response.ok) {
        setSaveState('error');
        setSaveError(result.error ?? 'Save failed');
        return;
      }
      if (result.settings) {
        setSavedSettings(prev => ({ ...prev, [activeCategory]: result.settings! }));
        setDraft(prev => ({ ...prev, [activeCategory]: result.settings! }));
      }
      setShowReview(false);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Network error');
    }
  }

  // ─── Category icon map ──────────────────────────────────────────────────────

  function getCategoryIcon(key: string): string {
    const map: Record<string, string> = {
      general: '⚙', security: '🛡', email: '✉', payment: '💳',
      integrations: '🔗', notifications: '🔔', storage: '💾',
      maintenance: '🔧', flags: '🚩', advanced: '⚡',
    };
    return map[key] ?? '●';
  }

  // ─── Success screen ──────────────────────────────────────────────────────────

  if (saveState === 'saved' && activeCategory) {
    return (
      <div>
        <div className="sys-layout">
          {/* Nav */}
          <nav className="sys-nav">
            <button className="sys-nav-back" onClick={() => { setActiveCategory(null); setSaveState('idle'); }}>
              ← Overview
            </button>
            {categories.map(cat => (
              <button
                key={cat.key}
                className={`sys-nav-item${activeCategory === cat.key ? ' active' : ''}`}
                onClick={() => { setActiveCategory(cat.key); setSaveState('idle'); }}
              >
                <span style={{ fontSize: 16 }}>{getCategoryIcon(cat.key)}</span>
                <div>
                  <span>{cat.label}</span>
                  <small>{cat.description}</small>
                </div>
              </button>
            ))}
          </nav>

          {/* Success state */}
          <main className="sys-main">
            <div className="sys-success">
              <div className="sys-success-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f1238' }}>Success!</h2>
              <p style={{ margin: 0, color: '#4b5676', fontSize: 15 }}>System settings have been updated successfully.</p>

              <div style={{ marginTop: 8, padding: '20px 28px', border: '1px solid #eef0f7', borderRadius: 14, background: '#fafbff', minWidth: 340 }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#0f1238' }}>What&apos;s Next?</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <button
                    type="button"
                    style={{ height: 40, border: '1px solid #d8d2ff', borderRadius: 9, background: '#fff', color: '#551cf2', fontSize: 13, fontWeight: 650, cursor: 'pointer', textAlign: 'left', padding: '0 14px' }}
                    onClick={() => setSaveState('idle')}
                  >
                    View updated settings →
                  </button>
                  <button
                    type="button"
                    style={{ height: 40, border: '1px solid #d8d2ff', borderRadius: 9, background: '#fff', color: '#551cf2', fontSize: 13, fontWeight: 650, cursor: 'pointer', textAlign: 'left', padding: '0 14px' }}
                    onClick={() => { setActiveCategory(null); setSaveState('idle'); }}
                  >
                    Go to System Overview →
                  </button>
                  <button
                    type="button"
                    style={{ height: 40, border: '1px solid #d8d2ff', borderRadius: 9, background: '#fff', color: '#551cf2', fontSize: 13, fontWeight: 650, cursor: 'pointer', textAlign: 'left', padding: '0 14px' }}
                    onClick={() => { setActiveCategory(null); setSaveState('idle'); }}
                  >
                    Configure another setting →
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="kf-primary"
                style={{ width: 340, height: 48, fontSize: 15, fontWeight: 700, border: 0, borderRadius: 11, background: 'linear-gradient(135deg, #6c35ff, #551cf2)', color: '#fff', cursor: 'pointer', boxShadow: '0 8px 20px rgba(85,28,242,.2)' }}
                onClick={() => { setActiveCategory(null); setSaveState('idle'); }}
              >
                Go to System Overview
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ─── Category form panels ────────────────────────────────────────────────────

  function renderGeneralForm() {
    const s = draft.general;
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>Platform Identity</h3>
          <div className="sys-fields">
            <Field label="Platform Name">
              <input className="sys-input" type="text" value={String(s.platformName ?? '')} onChange={e => setField('general', 'platformName', e.target.value)} />
            </Field>
            <Field label="Tagline">
              <input className="sys-input" type="text" value={String(s.tagline ?? '')} onChange={e => setField('general', 'tagline', e.target.value)} />
            </Field>
            <Field label="Support Email">
              <input className="sys-input" type="email" value={String(s.supportEmail ?? '')} onChange={e => setField('general', 'supportEmail', e.target.value)} />
            </Field>
            <Field label="Support Phone">
              <input className="sys-input" type="tel" value={String(s.supportPhone ?? '')} onChange={e => setField('general', 'supportPhone', e.target.value)} />
            </Field>
            <Field label="Default Time Zone">
              <select className="sys-select" value={String(s.timezone ?? 'America/New_York')} onChange={e => setField('general', 'timezone', e.target.value)}>
                {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney'].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </Field>
            <Field label="Primary Color">
              <input className="sys-input" type="text" value={String(s.primaryColor ?? '#6c35ff')} onChange={e => setField('general', 'primaryColor', e.target.value)} />
            </Field>
            <Field label="Logo URL" full>
              <input className="sys-input" type="url" value={String(s.logoUrl ?? '')} onChange={e => setField('general', 'logoUrl', e.target.value)} placeholder="https://..." />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function renderSecurityForm() {
    const s = draft.security;
    const maintenanceOn = Boolean(draft.maintenance?.maintenanceMode);
    return (
      <div className="sys-form">
        {maintenanceOn && (
          <div className="sys-warning">
            <span>⚠</span>
            <span>Maintenance mode is currently active. Authentication may be restricted for non-admin users.</span>
          </div>
        )}
        <div className="sys-form-section">
          <h3>Authentication Policies</h3>
          <div className="sys-fields">
            <Field label="Password Policy" hint="Minimum complexity requirements for user passwords">
              <select className="sys-select" value={String(s.passwordPolicy ?? 'strong')} onChange={e => setField('security', 'passwordPolicy', e.target.value)}>
                <option value="basic">Basic (8+ chars)</option>
                <option value="strong">Strong (12+ chars, mixed case, number)</option>
                <option value="very_strong">Very Strong (16+ chars, symbols required)</option>
              </select>
            </Field>
            <Field label="Two-Factor Authentication">
              <select className="sys-select" value={String(s.twoFactorAuth ?? 'required_admins')} onChange={e => setField('security', 'twoFactorAuth', e.target.value)}>
                <option value="disabled">Disabled</option>
                <option value="optional">Optional</option>
                <option value="required_admins">Required for Admins</option>
                <option value="required_all">Required for All Users</option>
              </select>
            </Field>
            <Field label="Session Timeout (minutes)" hint="How long before inactive sessions are expired">
              <input className="sys-input" type="number" min={5} value={Number(s.sessionTimeoutMinutes ?? 30)} onChange={e => setField('security', 'sessionTimeoutMinutes', Number(e.target.value))} />
            </Field>
            <Field label="Login Attempts Allowed" hint="Account is locked after this many failed attempts">
              <input className="sys-input" type="number" min={1} value={Number(s.loginAttemptsAllowed ?? 5)} onChange={e => setField('security', 'loginAttemptsAllowed', Number(e.target.value))} />
            </Field>
            <Field label="IP Whitelist" hint="One IP per line. Leave blank to allow all." full>
              <textarea className="sys-textarea" value={String(s.ipWhitelist ?? '')} onChange={e => setField('security', 'ipWhitelist', e.target.value)} placeholder="192.168.1.1&#10;10.0.0.0/24" />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function renderEmailForm() {
    const s = draft.email;
    const footerText = String(s.emailFooterText ?? '');
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>Email Configuration</h3>
          <div className="sys-fields">
            <Field label="From Name">
              <input className="sys-input" type="text" value={String(s.fromName ?? '')} onChange={e => setField('email', 'fromName', e.target.value)} />
            </Field>
            <Field label="From Email">
              <input className="sys-input" type="email" value={String(s.fromEmail ?? '')} onChange={e => setField('email', 'fromEmail', e.target.value)} />
            </Field>
            <Field label="Reply-To Email">
              <input className="sys-input" type="email" value={String(s.replyToEmail ?? '')} onChange={e => setField('email', 'replyToEmail', e.target.value)} />
            </Field>
            <Field label="Email Provider">
              <select className="sys-select" value={String(s.emailProvider ?? 'sendgrid')} onChange={e => setField('email', 'emailProvider', e.target.value)}>
                <option value="sendgrid">SendGrid</option>
                <option value="mailgun">Mailgun</option>
                <option value="aws_ses">AWS SES</option>
                <option value="smtp">Custom SMTP</option>
              </select>
            </Field>
            <Field label="API Key">
              <div className="sys-input-group">
                <input className="sys-input" type={showApiKey ? 'text' : 'password'} value={String(s.apiKey ?? '')} onChange={e => setField('email', 'apiKey', e.target.value)} placeholder="••••••••••••" />
                <button type="button" onClick={() => setShowApiKey(v => !v)}>{showApiKey ? 'Hide' : 'Show'}</button>
              </div>
            </Field>
            <Field label="Default Language">
              <select className="sys-select" value={String(s.defaultLanguage ?? 'en')} onChange={e => setField('email', 'defaultLanguage', e.target.value)}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="pt">Portuguese</option>
              </select>
            </Field>
            <Field label={`Email Footer Text (${footerText.length}/200)`} hint="Shown in the footer of all outgoing emails" full>
              <textarea className="sys-textarea" maxLength={200} value={footerText} onChange={e => setField('email', 'emailFooterText', e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="sys-form-section">
          <h3>Email Templates</h3>
          <a href="/admin/content" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 16px', border: '1px solid #d8d2ff', borderRadius: 9, color: '#551cf2', fontWeight: 650, fontSize: 13, textDecoration: 'none' }}>
            Manage Templates →
          </a>
        </div>
        <div className="sys-form-section">
          <h3>Email Verification</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#4b5676', fontWeight: 600 }}>Last verified: today</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 99, color: '#15803d', fontSize: 12, fontWeight: 650 }}>Verified ✓</span>
            <button type="button" style={{ height: 34, padding: '0 14px', border: '1px solid #d8d2ff', borderRadius: 8, background: '#fff', color: '#551cf2', fontSize: 12, fontWeight: 650, cursor: 'pointer' }}>Verify Now</button>
          </div>
        </div>
      </div>
    );
  }

  function renderPaymentForm() {
    const s = draft.payment;
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>Payment Gateways</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {/* Stripe */}
            <div className={`sys-toggle-card${Boolean(s.stripeLive) ? ' active' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>💳</span>
                <div>
                  <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Stripe</strong>
                  <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>
                    {Boolean(s.stripeLive) ? 'Connected to live account' : 'Running in test mode'}
                  </small>
                </div>
                <span style={{ marginLeft: 'auto', marginRight: 12, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: Boolean(s.stripeLive) ? '#f0fdf5' : '#fffbeb', color: Boolean(s.stripeLive) ? '#15803d' : '#b45309', border: `1px solid ${Boolean(s.stripeLive) ? '#bbf7d0' : '#fde68a'}` }}>
                  {Boolean(s.stripeLive) ? 'Live' : 'Test'}
                </span>
              </div>
              <Toggle checked={Boolean(s.stripeLive)} onChange={v => setField('payment', 'stripeLive', v)} />
            </div>
            {/* PayPal */}
            <div className={`sys-toggle-card${Boolean(s.paypalEnabled) ? ' active' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🅿</span>
                <div>
                  <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>PayPal</strong>
                  <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>PayPal checkout integration</small>
                </div>
                <span style={{ marginLeft: 'auto', marginRight: 12, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: Boolean(s.paypalEnabled) ? '#f0fdf5' : '#f5f5f5', color: Boolean(s.paypalEnabled) ? '#15803d' : '#6b7280', border: `1px solid ${Boolean(s.paypalEnabled) ? '#bbf7d0' : '#e5e7eb'}` }}>
                  {Boolean(s.paypalEnabled) ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <Toggle checked={Boolean(s.paypalEnabled)} onChange={v => setField('payment', 'paypalEnabled', v)} />
            </div>
            {/* Bank Transfer */}
            <div className={`sys-toggle-card${Boolean(s.bankTransferEnabled) ? ' active' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🏦</span>
                <div>
                  <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Bank Transfer</strong>
                  <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>ACH and wire transfer support</small>
                </div>
                <span style={{ marginLeft: 'auto', marginRight: 12, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: Boolean(s.bankTransferEnabled) ? '#f0fdf5' : '#f5f5f5', color: Boolean(s.bankTransferEnabled) ? '#15803d' : '#6b7280', border: `1px solid ${Boolean(s.bankTransferEnabled) ? '#bbf7d0' : '#e5e7eb'}` }}>
                  {Boolean(s.bankTransferEnabled) ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <Toggle checked={Boolean(s.bankTransferEnabled)} onChange={v => setField('payment', 'bankTransferEnabled', v)} />
            </div>
          </div>
        </div>
        <div className="sys-form-section">
          <h3>Fees &amp; Currency</h3>
          <div className="sys-fields">
            <Field label="Platform Fee (%)" hint="Percentage charged on each successful donation">
              <input className="sys-input" type="number" min={0} max={100} step={0.1} value={Number(s.platformFeePct ?? 2.5)} onChange={e => setField('payment', 'platformFeePct', parseFloat(e.target.value))} />
            </Field>
            <Field label="Currency">
              <select className="sys-select" value={String(s.currency ?? 'USD')} onChange={e => setField('payment', 'currency', e.target.value)}>
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function renderIntegrationsForm() {
    const s = draft.integrations;
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>Third-Party Integrations</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {/* Google Analytics */}
            <div className={`sys-toggle-card${Boolean(s.googleAnalyticsEnabled) ? ' active' : ''}`}>
              <div>
                <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Google Analytics</strong>
                <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>Track page views and user behaviour</small>
                {Boolean(s.googleAnalyticsEnabled) && (
                  <input className="sys-input" type="text" value={String(s.gaId ?? '')} onChange={e => setField('integrations', 'gaId', e.target.value)} placeholder="G-XXXXXXXXXX" style={{ marginTop: 10, maxWidth: 240 }} />
                )}
              </div>
              <Toggle checked={Boolean(s.googleAnalyticsEnabled)} onChange={v => setField('integrations', 'googleAnalyticsEnabled', v)} />
            </div>
            {/* Mailchimp */}
            <div className={`sys-toggle-card${Boolean(s.mailchimpEnabled) ? ' active' : ''}`}>
              <div>
                <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Mailchimp</strong>
                <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>Sync donors to your Mailchimp audience</small>
                {Boolean(s.mailchimpEnabled) && (
                  <input className="sys-input" type="text" value={String(s.mailchimpKey ?? '')} onChange={e => setField('integrations', 'mailchimpKey', e.target.value)} placeholder="Mailchimp API Key" style={{ marginTop: 10, maxWidth: 300 }} />
                )}
              </div>
              <Toggle checked={Boolean(s.mailchimpEnabled)} onChange={v => setField('integrations', 'mailchimpEnabled', v)} />
            </div>
            {/* Slack */}
            <div className={`sys-toggle-card${Boolean(s.slackEnabled) ? ' active' : ''}`}>
              <div>
                <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Slack</strong>
                <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>Post admin alerts to Slack channels</small>
                {Boolean(s.slackEnabled) && (
                  <input className="sys-input" type="text" value={String(s.slackWebhook ?? '')} onChange={e => setField('integrations', 'slackWebhook', e.target.value)} placeholder="https://hooks.slack.com/services/..." style={{ marginTop: 10, maxWidth: 340 }} />
                )}
              </div>
              <Toggle checked={Boolean(s.slackEnabled)} onChange={v => setField('integrations', 'slackEnabled', v)} />
            </div>
            {/* Zapier */}
            <div className={`sys-toggle-card${Boolean(s.zapierEnabled) ? ' active' : ''}`}>
              <div>
                <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Zapier</strong>
                <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>Automate workflows with 5,000+ apps</small>
              </div>
              <Toggle checked={Boolean(s.zapierEnabled)} onChange={v => setField('integrations', 'zapierEnabled', v)} />
            </div>
          </div>
        </div>
        <div className="sys-form-section">
          <h3>Webhook Endpoint</h3>
          <div className="sys-fields one-col">
            <Field label="Webhook URL" hint="Your platform webhook endpoint. All events will be POSTed here.">
              <input className="sys-input" type="text" value={String(s.webhookUrl ?? '')} onChange={e => setField('integrations', 'webhookUrl', e.target.value)} placeholder="https://api.CharitMe.org/webhook" />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function renderNotificationsForm() {
    const s = draft.notifications;
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>Notification Channels</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { key: 'inAppEnabled', label: 'In-App Notifications', icon: '🔔', desc: 'Show notifications inside the platform' },
              { key: 'emailEnabled', label: 'Email Notifications', icon: '✉', desc: 'Send email digests and alerts' },
              { key: 'pushEnabled', label: 'Push Notifications', icon: '📱', desc: 'Browser and mobile push notifications' },
              { key: 'smsEnabled', label: 'SMS Notifications', icon: '💬', desc: 'Text message alerts (carrier rates may apply)' },
            ].map(({ key, label, icon, desc }) => (
              <div key={key} className={`sys-toggle-card${Boolean(s[key]) ? ' active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <div>
                    <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>{label}</strong>
                    <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>{desc}</small>
                  </div>
                </div>
                <Toggle checked={Boolean(s[key])} onChange={v => setField('notifications', key, v)} />
              </div>
            ))}
          </div>
        </div>
        <div className="sys-form-section">
          <h3>Quiet Hours</h3>
          <div className="sys-fields">
            <Field label="Start Time">
              <input className="sys-input" type="time" value={String(s.quietHoursStart ?? '22:00')} onChange={e => setField('notifications', 'quietHoursStart', e.target.value)} />
            </Field>
            <Field label="End Time">
              <input className="sys-input" type="time" value={String(s.quietHoursEnd ?? '07:00')} onChange={e => setField('notifications', 'quietHoursEnd', e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function renderStorageForm() {
    const s = draft.storage;
    const provider = String(s.cdnProvider ?? 'vercel');
    const showCdnUrl = provider === 'cloudflare' || provider === 'aws';
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>CDN &amp; Storage</h3>
          <div className="sys-fields">
            <Field label="CDN Provider">
              <select className="sys-select" value={provider} onChange={e => setField('storage', 'cdnProvider', e.target.value)}>
                <option value="vercel">Vercel (built-in)</option>
                <option value="cloudflare">Cloudflare CDN</option>
                <option value="aws">AWS CloudFront</option>
              </select>
            </Field>
            {showCdnUrl && (
              <Field label="CDN URL" hint="Base URL for your CDN">
                <input className="sys-input" type="text" value={String(s.cdnUrl ?? '')} onChange={e => setField('storage', 'cdnUrl', e.target.value)} placeholder="https://cdn.example.com" />
              </Field>
            )}
            <Field label="Max Upload Size (MB)">
              <input className="sys-input" type="number" min={1} max={500} value={Number(s.maxUploadMb ?? 10)} onChange={e => setField('storage', 'maxUploadMb', Number(e.target.value))} />
            </Field>
            <Field label="Allowed File Types" hint="Comma-separated list of file extensions" full>
              <input className="sys-input" type="text" value={String(s.allowedFileTypes ?? '')} onChange={e => setField('storage', 'allowedFileTypes', e.target.value)} placeholder="jpg,jpeg,png,gif,webp,pdf,mp4" />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function renderMaintenanceForm() {
    const s = draft.maintenance;
    const backupEnabled = Boolean(s.automatedBackup);
    const maintenanceOn = Boolean(s.maintenanceMode);
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>Backup Settings</h3>
          <div className="sys-toggle-card" style={{ marginBottom: 12 }}>
            <div>
              <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Automated Backup</strong>
              <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>Automatically back up your database on a schedule</small>
            </div>
            <Toggle checked={backupEnabled} onChange={v => setField('maintenance', 'automatedBackup', v)} />
          </div>
          <div className="sys-fields">
            <Field label="Backup Frequency">
              <select className="sys-select" value={String(s.backupFrequency ?? 'daily')} onChange={e => setField('maintenance', 'backupFrequency', e.target.value)} disabled={!backupEnabled}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
            <Field label="Backup Retention (days)">
              <input className="sys-input" type="number" min={1} value={Number(s.backupRetentionDays ?? 30)} onChange={e => setField('maintenance', 'backupRetentionDays', Number(e.target.value))} disabled={!backupEnabled} />
            </Field>
            <Field label="Log Retention (days)">
              <input className="sys-input" type="number" min={1} value={Number(s.logRetentionDays ?? 90)} onChange={e => setField('maintenance', 'logRetentionDays', Number(e.target.value))} />
            </Field>
          </div>
        </div>
        <div className="sys-form-section">
          <h3>Maintenance Mode</h3>
          {maintenanceOn && (
            <div className="sys-warning danger">
              <span>⛔</span>
              <span><strong>Warning:</strong> Enabling maintenance mode will make the site inaccessible to all users except admins.</span>
            </div>
          )}
          <div className="sys-toggle-card" style={{ marginTop: maintenanceOn ? 12 : 0 }}>
            <div>
              <strong style={{ fontSize: 14, fontWeight: 700, color: maintenanceOn ? '#be123c' : '#0f1238' }}>Maintenance Mode</strong>
              <small style={{ display: 'block', fontSize: 12, color: maintenanceOn ? '#e11d48' : '#67718e', marginTop: 2 }}>
                {maintenanceOn ? 'Site is currently in maintenance mode' : 'Enable to temporarily take down the site'}
              </small>
            </div>
            <Toggle checked={maintenanceOn} onChange={v => setField('maintenance', 'maintenanceMode', v)} />
          </div>
        </div>
      </div>
    );
  }

  function renderFlagsForm() {
    const s = draft.flags;
    const flagDefs = [
      { key: 'aiGrowthPlan', label: 'AI Growth Plan', desc: 'AI-powered campaign optimization suggestions' },
      { key: 'recurringDonations', label: 'Recurring Donations', desc: 'Allow donors to set up recurring monthly donations' },
      { key: 'donorLeaderboard', label: 'Donor Leaderboard', desc: 'Show public leaderboard of top donors' },
      { key: 'campaignAnalytics', label: 'Campaign Analytics', desc: 'Advanced analytics dashboard for organizers' },
      { key: 'referralProgram', label: 'Referral Program', desc: 'Enable referral tracking and rewards' },
    ];
    return (
      <div className="sys-form">
        <div className="sys-form-section">
          <h3>Platform Features</h3>
          <div className="sys-flag-grid">
            {flagDefs.map(({ key, label, desc }) => {
              const enabled = Boolean(s[key]);
              return (
                <div key={key} className={`sys-toggle-card${enabled ? ' active' : ''}`}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>{label}</strong>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: enabled ? '#f0fdf5' : '#f5f5f5', color: enabled ? '#15803d' : '#6b7280', border: `1px solid ${enabled ? '#bbf7d0' : '#e5e7eb'}` }}>
                        {enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 4 }}>{desc}</small>
                  </div>
                  <Toggle checked={enabled} onChange={v => setField('flags', key, v)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderAdvancedForm() {
    const s = draft.advanced;
    const debugOn = Boolean(s.debugMode);
    return (
      <div className="sys-form">
        {debugOn && (
          <div className="sys-warning">
            <span>⚠</span>
            <span><strong>Warning:</strong> Debug mode is active. Verbose logs are being written. Do not enable in production for extended periods.</span>
          </div>
        )}
        <div className="sys-form-section">
          <h3>System Configuration</h3>
          <div className="sys-fields">
            <Field label="API Rate Limit (requests/minute)">
              <input className="sys-input" type="number" min={1} value={Number(s.apiRateLimit ?? 100)} onChange={e => setField('advanced', 'apiRateLimit', Number(e.target.value))} />
            </Field>
            <Field label="Cache TTL (seconds)">
              <input className="sys-input" type="number" min={0} value={Number(s.cacheTtlSeconds ?? 3600)} onChange={e => setField('advanced', 'cacheTtlSeconds', Number(e.target.value))} />
            </Field>
            <Field label="Webhook Timeout (seconds)">
              <input className="sys-input" type="number" min={1} value={Number(s.webhookTimeoutSeconds ?? 30)} onChange={e => setField('advanced', 'webhookTimeoutSeconds', Number(e.target.value))} />
            </Field>
          </div>
        </div>
        <div className="sys-form-section">
          <h3>Debugging &amp; Registrations</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className={`sys-toggle-card${debugOn ? ' active' : ''}`}>
              <div>
                <strong style={{ fontSize: 14, fontWeight: 700, color: debugOn ? '#c2410c' : '#0f1238' }}>Debug Mode</strong>
                <small style={{ display: 'block', fontSize: 12, color: debugOn ? '#ea580c' : '#67718e', marginTop: 2 }}>Enable verbose logging — not for production</small>
              </div>
              <Toggle checked={debugOn} onChange={v => setField('advanced', 'debugMode', v)} />
            </div>
            <div className={`sys-toggle-card${Boolean(s.allowNewRegistrations) ? ' active' : ''}`}>
              <div>
                <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f1238' }}>Allow New Registrations</strong>
                <small style={{ display: 'block', fontSize: 12, color: '#67718e', marginTop: 2 }}>Allow new users to sign up for the platform</small>
              </div>
              <Toggle checked={Boolean(s.allowNewRegistrations)} onChange={v => setField('advanced', 'allowNewRegistrations', v)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCategoryForm(key: string) {
    switch (key) {
      case 'general': return renderGeneralForm();
      case 'security': return renderSecurityForm();
      case 'email': return renderEmailForm();
      case 'payment': return renderPaymentForm();
      case 'integrations': return renderIntegrationsForm();
      case 'notifications': return renderNotificationsForm();
      case 'storage': return renderStorageForm();
      case 'maintenance': return renderMaintenanceForm();
      case 'flags': return renderFlagsForm();
      case 'advanced': return renderAdvancedForm();
      default: return <p style={{ color: '#67718e' }}>Select a category from the left.</p>;
    }
  }

  // ─── Overview panel ──────────────────────────────────────────────────────────

  function renderOverview() {
    const isHealthy = overview.healthStatus === 'Healthy';
    return (
      <div>
        {/* Health bar */}
        <div className={`sys-health-bar${isHealthy ? '' : ' degraded'}`}>
          <span>{isHealthy ? '✓' : '⚠'}</span>
          <span>System Health: {isHealthy ? 'All Systems Operational' : 'Performance Degraded'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* KPI row */}
        <div className="kf-metrics" style={{ marginBottom: 20 }}>
          {[
            { label: 'Services Online', value: overview.servicesOnline, icon: '✓', color: '#6c35ff' },
            { label: 'Integrations Active', value: overview.integrationsActive, icon: '🔗', color: '#19b86a' },
            { label: 'Scheduled Jobs', value: overview.scheduledJobs, icon: '⏱', color: '#2f80ed' },
            { label: 'Error Rate', value: overview.errorRate, icon: overview.errorRate === '0%' ? '✓' : '⚠', color: overview.errorRate === '0%' ? '#15803d' : '#c2410c' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '16px 18px', border: '1px solid #eef0f7', borderRadius: 14, background: '#fafbff' }}>
              <small style={{ display: 'block', color: '#67718e', fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</small>
              <strong style={{ display: 'block', marginTop: 8, fontSize: 26, fontWeight: 800, color }}>{value}</strong>
            </div>
          ))}
        </div>

        {/* Two-column bottom */}
        <div className="sys-overview-grid">
          {/* Recent activity */}
          <div style={{ border: '1px solid #eef0f7', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef0f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13, fontWeight: 700, color: '#0f1238' }}>Recent System Activity</strong>
              <button type="button" style={{ border: 0, background: 'transparent', color: '#6c35ff', fontSize: 12, fontWeight: 650, cursor: 'pointer' }}>View all activity →</button>
            </div>
            <div className="sys-activity-list">
              {recentActivity.slice(0, 6).map(ev => (
                <div key={ev.id} className="sys-activity-row">
                  <span style={{ fontSize: 16 }}>
                    {ev.status === 'Failed' ? '❌' : ev.status === 'Processed' ? '✓' : '⏳'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 650, color: '#101842', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.action}</span>
                    <span style={{ color: '#8c9ab5' }}>{ev.category}</span>
                  </div>
                  <span style={{ color: '#8c9ab5', flexShrink: 0 }}>{ev.time}</span>
                  <StatusPill>{ev.status}</StatusPill>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div style={{ padding: '20px 16px', color: '#8c9ab5', fontSize: 13 }}>No recent activity</div>
              )}
            </div>
          </div>

          {/* Resource usage */}
          <div style={{ border: '1px solid #eef0f7', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef0f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 13, fontWeight: 700, color: '#0f1238' }}>Resource Usage</strong>
              <button
                type="button"
                style={{ border: 0, background: 'transparent', color: '#6c35ff', fontSize: 12, fontWeight: 650, cursor: 'pointer' }}
                onClick={() => setActiveCategory('general')}
              >
                View all system settings →
              </button>
            </div>
            <div style={{ padding: '16px' }} className="sys-resource-bar">
              {resourceUsage.map(r => (
                <div key={r.label} className="sys-resource-item">
                  <div className="sys-resource-label">
                    <span>{r.label}</span>
                    <span>{r.value}%</span>
                  </div>
                  <div className="sys-progress">
                    <div className="sys-progress-fill" style={{ width: `${r.value}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Review overlay ──────────────────────────────────────────────────────────

  const activeCat = categories.find(c => c.key === activeCategory);
  const changes = activeCategory ? computeChanges(activeCategory) : [];

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 32px 40px' }}>
      <div className="sys-layout">
        {/* Left nav */}
        <nav className="sys-nav">
          {activeCategory && (
            <button className="sys-nav-back" onClick={() => setActiveCategory(null)}>
              ← Overview
            </button>
          )}
          {categories.map(cat => (
            <button
              key={cat.key}
              className={`sys-nav-item${activeCategory === cat.key ? ' active' : ''}`}
              onClick={() => { setActiveCategory(cat.key); setSaveState('idle'); setShowReview(false); }}
            >
              <span style={{ fontSize: 16 }}>{getCategoryIcon(cat.key)}</span>
              <div>
                <span>{cat.label}</span>
                <small>{cat.description}</small>
              </div>
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="sys-main">
          {activeCategory === null ? (
            renderOverview()
          ) : (
            <>
              {/* Category header */}
              <div className="sys-cat-header">
                <KFIcon name={activeCat?.icon ?? 'gear'} />
                <h2>{activeCat?.label}</h2>
                {hasChanges && (
                  <span className="sys-unsaved-badge">● Unsaved Changes</span>
                )}
              </div>

              {/* Error banner */}
              {saveState === 'error' && (
                <div className="sys-warning danger" style={{ marginBottom: 16 }}>
                  <span>⛔</span>
                  <span>{saveError}</span>
                </div>
              )}

              {/* Form */}
              {renderCategoryForm(activeCategory)}

              {/* Form actions */}
              <div className="sys-form-actions" style={{ marginTop: 24 }}>
                <button
                  type="button"
                  className="kf-primary"
                  disabled={!hasChanges || saveState === 'saving'}
                  style={{
                    opacity: (!hasChanges || saveState === 'saving') ? 0.5 : 1,
                    cursor: (!hasChanges || saveState === 'saving') ? 'not-allowed' : 'pointer',
                    height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, border: 0, borderRadius: 9,
                    background: 'linear-gradient(135deg, #6c35ff, #551cf2)', color: '#fff',
                    boxShadow: hasChanges ? '0 8px 18px rgba(85,28,242,.18)' : 'none',
                  }}
                  onClick={() => setShowReview(true)}
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save Changes'}
                </button>
                {hasChanges && (
                  <button
                    type="button"
                    style={{ border: 0, background: 'transparent', color: '#6c35ff', fontSize: 13, fontWeight: 650, cursor: 'pointer', padding: '0 8px' }}
                    onClick={() => setDraft(prev => ({ ...prev, [activeCategory]: savedSettings[activeCategory as keyof AllSettings] }))}
                  >
                    Discard Changes
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Review overlay */}
      {showReview && activeCategory && (
        <div className="sys-review-overlay" role="dialog" aria-modal="true" aria-label="Review system changes">
          <div className="sys-review-panel">
            <div className="sys-review-header">
              <button
                type="button"
                style={{ border: 0, background: 'transparent', color: '#6c35ff', fontSize: 13, fontWeight: 650, cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => setShowReview(false)}
              >
                ← Back to {activeCat?.label}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f1238' }}>Review Changes</h2>
                <span className="sys-unsaved-badge">Unsaved Changes</span>
              </div>
            </div>

            <div className="sys-review-body">
              {/* Changes summary */}
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0f1238', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Changes Summary</h3>
                {changes.length === 0 ? (
                  <p style={{ color: '#67718e', fontSize: 13 }}>No changes detected.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {/* Header row */}
                    <div className="sys-diff-row" style={{ background: '#f8f9fc', fontWeight: 700, fontSize: 11, color: '#67718e', textTransform: 'uppercase' }}>
                      <span>Field</span>
                      <span>Before</span>
                      <span>After</span>
                    </div>
                    {changes.map(ch => (
                      <div key={ch.key} className="sys-diff-row">
                        <span style={{ fontWeight: 650, color: '#101842' }}>{ch.label}</span>
                        <span className="sys-diff-old">{ch.old}</span>
                        <span className="sys-diff-new">{ch.new}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Impact */}
              <div style={{ padding: '14px 16px', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 10, color: '#15803d', fontSize: 13, fontWeight: 600 }}>
                <strong style={{ fontWeight: 700 }}>Impact:</strong> These changes will apply immediately. No downtime expected.
              </div>
            </div>

            <div className="sys-review-footer">
              <button
                type="button"
                className="kf-primary"
                disabled={saveState === 'saving' || changes.length === 0}
                style={{
                  width: '100%', height: 48, fontSize: 15, fontWeight: 700, border: 0, borderRadius: 11,
                  background: 'linear-gradient(135deg, #6c35ff, #551cf2)', color: '#fff', cursor: saveState === 'saving' ? 'wait' : 'pointer',
                  boxShadow: '0 8px 20px rgba(85,28,242,.2)', opacity: (saveState === 'saving' || changes.length === 0) ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
                onClick={handleSave}
              >
                {saveState === 'saving' ? (
                  <>
                    <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Saving…
                  </>
                ) : 'Save Changes'}
              </button>
              <button
                type="button"
                style={{ width: '100%', height: 42, border: '1px solid #d8d2ff', borderRadius: 9, background: '#fff', color: '#551cf2', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setShowReview(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
