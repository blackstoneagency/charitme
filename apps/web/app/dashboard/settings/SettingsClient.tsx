'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';
import BillingPortalButton from './BillingPortalButton';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ProfileData {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  plan: string | null;
  stripe_customer_id: string | null;
  org_name: string | null;
  org_website: string | null;
  org_tagline: string | null;
  timezone: string | null;
  currency: string | null;
  language: string | null;
  date_format: string | null;
  time_format: string | null;
  show_public_profile: boolean | null;
  campaign_recommendations: boolean | null;
}

interface Props {
  initialProfile: ProfileData;
  campaignsCount: number;
  userEmail: string;
  hasStripeCustomer: boolean;
}

type Section =
  | 'general'
  | 'profile'
  | 'organization'
  | 'notifications'
  | 'security'
  | 'payment'
  | 'email-templates'
  | 'privacy'
  | 'billing'
  | 'data'
  | 'advanced';

interface Toast {
  kind: 'success' | 'error';
  msg: string;
}

// ─────────────────────────────────────────────
// Plan helpers
// ─────────────────────────────────────────────
const PLAN_LABELS: Record<string, { label: string; chipClass: string; campaignLimit: number }> = {
  free:    { label: 'Free',    chipClass: 'free',    campaignLimit: 1  },
  starter: { label: 'Starter', chipClass: 'starter', campaignLimit: 5  },
  pro:     { label: 'Pro',     chipClass: 'pro',     campaignLimit: 999 },
};

// ─────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────
function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label className="kf-toggle-wrap" htmlFor={id} style={{ cursor: 'pointer' }}>
      <input
        id={id}
        type="checkbox"
        className="kf-toggle-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="kf-toggle-track" />
    </label>
  );
}

// ─────────────────────────────────────────────
// Nav item
// ─────────────────────────────────────────────
function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`kf-setnav-item${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────
// Tiny inline SVGs (no external dep)
// ─────────────────────────────────────────────
const Ico = {
  settings: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="10" cy="7" r="3.5" />
      <path d="M3 18c0-3.87 3.13-7 7-7s7 3.13 7 7" />
    </svg>
  ),
  org: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="2" y="7" width="16" height="11" rx="2" />
      <path d="M6 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M10 2a6 6 0 0 1 6 6c0 3 1 4 2 5H2c1-1 2-2 2-5a6 6 0 0 1 6-6z" />
      <path d="M8 17a2 2 0 0 0 4 0" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="4" y="9" width="12" height="9" rx="2" />
      <path d="M7 9V7a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="2" y="5" width="16" height="12" rx="2" />
      <path d="M2 9h16" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <rect x="2" y="4" width="16" height="13" rx="2" />
      <path d="M2 7l8 5 8-5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M10 2l7 3v5c0 4-3.5 7-7 8-3.5-1-7-4-7-8V5l7-3z" />
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M3 15h14M3 15l2-8 5 4 5-4 2 8H3z" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 15h14" />
    </svg>
  ),
  sliders: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M4 6h12M4 10h12M4 14h12" />
      <circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="14" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <circle cx="10" cy="10" r="8" />
      <path d="M8 8a2 2 0 1 1 2 2v2" />
      <circle cx="10" cy="15" r=".8" fill="currentColor" stroke="none" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 10l5 5 7-8" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M5 10h10M11 6l4 4-4 4" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      <path d="M8 12l-2 2a3 3 0 1 0 4.24 4.24l2-2a3 3 0 0 0-4.24-4.24z" />
      <path d="M12 8l2-2a3 3 0 1 0-4.24-4.24L7.76 3.76A3 3 0 0 0 12 8z" />
      <path d="M9 11l2-2" />
    </svg>
  ),
};

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function SettingsClient({
  initialProfile,
  campaignsCount,
  userEmail,
  hasStripeCustomer,
}: Props) {
  const uid = useId();
  const [section, setSection] = useState<Section>('general');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // ── General / Organisation / Locale / Prefs form state ──────────
  const [orgName, setOrgName] = useState(initialProfile.org_name ?? '');
  const [orgWebsite, setOrgWebsite] = useState(initialProfile.org_website ?? '');
  const [orgTagline, setOrgTagline] = useState(initialProfile.org_tagline ?? '');
  const [timezone, setTimezone] = useState(initialProfile.timezone ?? 'America/New_York');
  const [currency, setCurrency] = useState(initialProfile.currency ?? 'usd');
  const [language, setLanguage] = useState(initialProfile.language ?? 'en');
  const [dateFormat, setDateFormat] = useState(initialProfile.date_format ?? 'MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState(initialProfile.time_format ?? '12h');
  const [showPublicProfile, setShowPublicProfile] = useState(initialProfile.show_public_profile ?? true);
  const [campaignRecs, setCampaignRecs] = useState(initialProfile.campaign_recommendations ?? true);

  // ── Profile form state ───────────────────────────────────────────
  const [fullName, setFullName] = useState(initialProfile.full_name ?? '');
  const [bio, setBio] = useState(initialProfile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url ?? '');

  const currentPlan = (initialProfile.plan ?? 'free').toLowerCase();
  const planInfo = PLAN_LABELS[currentPlan] ?? PLAN_LABELS.free;
  const campaignPct = planInfo.campaignLimit >= 999
    ? Math.min((campaignsCount / 20) * 100, 100)
    : Math.min((campaignsCount / planInfo.campaignLimit) * 100, 100);

  function showToast(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveGeneral() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name: orgName || null,
          org_website: orgWebsite || null,
          org_tagline: orgTagline || null,
          timezone,
          currency,
          language,
          date_format: dateFormat,
          time_format: timeFormat,
          show_public_profile: showPublicProfile,
          campaign_recommendations: campaignRecs,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast('error', (err as { error?: string }).error ?? 'Failed to save settings.');
        return;
      }
      showToast('success', 'Settings saved!');
    } catch {
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { full_name: fullName, bio: bio || null };
      if (avatarUrl) body.avatar_url = avatarUrl;
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast('error', (err as { error?: string }).error ?? 'Failed to save profile.');
        return;
      }
      showToast('success', 'Profile saved!');
    } catch {
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────
  // Left nav definition
  // ─────────────────────────────────────────────
  const navGroups = [
    {
      label: 'Account',
      items: [
        { id: 'general' as Section,       label: 'General',         icon: Ico.settings },
        { id: 'profile' as Section,        label: 'Profile',         icon: Ico.user },
        { id: 'organization' as Section,   label: 'Organization',    icon: Ico.org },
        { id: 'notifications' as Section,  label: 'Notifications',   icon: Ico.bell },
        { id: 'security' as Section,       label: 'Security',        icon: Ico.lock },
      ],
    },
    {
      label: 'Billing',
      items: [
        { id: 'payment' as Section,        label: 'Payment Methods', icon: Ico.card },
        { id: 'email-templates' as Section, label: 'Email Templates', icon: Ico.mail },
        { id: 'privacy' as Section,        label: 'Privacy',         icon: Ico.shield },
        { id: 'billing' as Section,        label: 'Billing & Plan',  icon: Ico.crown },
      ],
    },
    {
      label: 'Advanced',
      items: [
        { id: 'data' as Section,           label: 'Data & Export',   icon: Ico.download },
        { id: 'advanced' as Section,       label: 'Advanced',        icon: Ico.sliders },
      ],
    },
  ];

  // ─────────────────────────────────────────────
  // Render panel content
  // ─────────────────────────────────────────────
  function renderPanel() {
    switch (section) {
      case 'general':
        return (
          <>
            {/* Organisation Information */}
            <div className="kf-setpanel">
              <div className="kf-setpanel-head">
                <div className="kf-setpanel-title">
                  <div className="kf-setpanel-icon">{Ico.org}</div>
                  <div>
                    <h2>Organisation Information</h2>
                    <p>Your public-facing organisation details.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="kf-setpanel-save"
                  onClick={saveGeneral}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
              <div className="kf-setpanel-body">
                <div className="kf-setrow">
                  <SetField label="Organisation Name" hint="Shown on your public campaigns">
                    <input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Hope Foundation"
                      maxLength={120}
                    />
                  </SetField>
                  <SetField label="Website">
                    <input
                      value={orgWebsite}
                      onChange={(e) => setOrgWebsite(e.target.value)}
                      placeholder="https://yourorg.com"
                      type="url"
                    />
                  </SetField>
                </div>
                <SetField label="Tagline" className="full">
                  <input
                    value={orgTagline}
                    onChange={(e) => setOrgTagline(e.target.value)}
                    placeholder="A short description of your mission…"
                    maxLength={200}
                  />
                </SetField>
              </div>
            </div>

            {/* Currency & Locale */}
            <div className="kf-setpanel">
              <div className="kf-setpanel-head">
                <div className="kf-setpanel-title">
                  <div className="kf-setpanel-icon">{Ico.settings}</div>
                  <div>
                    <h2>Currency &amp; Locale</h2>
                    <p>Set your default currency and language.</p>
                  </div>
                </div>
              </div>
              <div className="kf-setpanel-body">
                <div className="kf-setrow triple">
                  <SetField label="Currency">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="usd">USD – US Dollar</option>
                      <option value="eur">EUR – Euro</option>
                      <option value="gbp">GBP – British Pound</option>
                      <option value="cad">CAD – Canadian Dollar</option>
                      <option value="aud">AUD – Australian Dollar</option>
                    </select>
                  </SetField>
                  <SetField label="Language">
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="pt">Portuguese</option>
                    </select>
                  </SetField>
                  <SetField label="Timezone">
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="America/Anchorage">Alaska Time (AKT)</option>
                      <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Australia/Sydney">Sydney (AEST)</option>
                    </select>
                  </SetField>
                </div>
              </div>
            </div>

            {/* Date & Time Format */}
            <div className="kf-setpanel">
              <div className="kf-setpanel-head">
                <div className="kf-setpanel-title">
                  <div className="kf-setpanel-icon">{Ico.settings}</div>
                  <div>
                    <h2>Date &amp; Time Format</h2>
                    <p>How dates and times appear across your dashboard.</p>
                  </div>
                </div>
              </div>
              <div className="kf-setpanel-body">
                <div className="kf-setrow">
                  <SetField label="Date Format">
                    <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (International)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                    </select>
                  </SetField>
                  <SetField label="Time Format">
                    <select value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)}>
                      <option value="12h">12-hour (AM/PM)</option>
                      <option value="24h">24-hour</option>
                    </select>
                  </SetField>
                </div>
              </div>
            </div>

            {/* Other Preferences */}
            <div className="kf-setpanel">
              <div className="kf-setpanel-head">
                <div className="kf-setpanel-title">
                  <div className="kf-setpanel-icon">{Ico.sliders}</div>
                  <div>
                    <h2>Other Preferences</h2>
                    <p>Visibility and recommendation settings.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="kf-setpanel-save"
                  onClick={saveGeneral}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
              <div className="kf-setpanel-body">
                <PrefRow
                  id={`${uid}-spp`}
                  label="Show Public Profile"
                  desc="Allow your profile to appear in KindFund search results"
                  checked={showPublicProfile}
                  onChange={setShowPublicProfile}
                />
                <PrefRow
                  id={`${uid}-cr`}
                  label="Campaign Recommendations"
                  desc="Receive personalised campaign improvement tips by email"
                  checked={campaignRecs}
                  onChange={setCampaignRecs}
                />
              </div>
            </div>
          </>
        );

      case 'profile':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.user}</div>
                <div>
                  <h2>Profile</h2>
                  <p>Your personal information and public bio.</p>
                </div>
              </div>
              <button
                type="button"
                className="kf-setpanel-save"
                onClick={saveProfile}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            <div className="kf-setpanel-body">
              <div className="kf-setrow">
                <SetField label="Full Name">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    maxLength={120}
                  />
                </SetField>
                <SetField label="Email Address" hint="Contact support to change your email">
                  <input value={userEmail} disabled style={{ background: '#f7f8fc', color: '#8c9ab5' }} />
                </SetField>
              </div>
              <SetField label="Bio" className="full">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell donors a bit about yourself…"
                  maxLength={500}
                />
              </SetField>
              <SetField label="Avatar URL" hint="Paste a direct image URL (HTTPS)">
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  type="url"
                />
              </SetField>
            </div>
          </div>
        );

      case 'organization':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.org}</div>
                <div>
                  <h2>Organization</h2>
                  <p>Details about your fundraising organisation.</p>
                </div>
              </div>
              <button
                type="button"
                className="kf-setpanel-save"
                onClick={saveGeneral}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            <div className="kf-setpanel-body">
              <div className="kf-setrow">
                <SetField label="Organisation Name">
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Hope Foundation"
                    maxLength={120}
                  />
                </SetField>
                <SetField label="Website">
                  <input
                    value={orgWebsite}
                    onChange={(e) => setOrgWebsite(e.target.value)}
                    placeholder="https://yourorg.com"
                    type="url"
                  />
                </SetField>
              </div>
              <SetField label="Tagline" className="full">
                <input
                  value={orgTagline}
                  onChange={(e) => setOrgTagline(e.target.value)}
                  placeholder="A short mission statement…"
                  maxLength={200}
                />
              </SetField>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.bell}</div>
                <div>
                  <h2>Notifications</h2>
                  <p>Control which emails and alerts you receive.</p>
                </div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              {[
                { id: `${uid}-n1`, label: 'New donation received', desc: 'Email when a donor contributes to your campaign', default: true },
                { id: `${uid}-n2`, label: 'Donor leaves a message', desc: 'Email when a donor adds a message', default: true },
                { id: `${uid}-n3`, label: 'Campaign milestone reached', desc: 'Email at 25%, 50%, 75%, 100% funded', default: true },
                { id: `${uid}-n4`, label: 'Weekly performance digest', desc: 'Weekly summary of campaign performance', default: false },
                { id: `${uid}-n5`, label: 'Product updates', desc: 'News about new KindFund features', default: false },
              ].map(({ id, label, desc, default: def }) => (
                <NotifRow key={id} id={id} label={label} desc={desc} defaultOn={def} />
              ))}
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.lock}</div>
                <div>
                  <h2>Security</h2>
                  <p>Manage your password and account access.</p>
                </div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <div className="kf-setpref">
                <div className="kf-setpref-info">
                  <strong>Password</strong>
                  <span>Update your login password</span>
                </div>
                <Link
                  href="/forgot-password"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}
                >
                  Change Password
                </Link>
              </div>
              <div className="kf-setpref">
                <div className="kf-setpref-info">
                  <strong>Two-Factor Authentication</strong>
                  <span>Add an extra layer of protection to your account</span>
                </div>
                <span className="kf-plan-chip free" style={{ fontSize: 12 }}>Coming soon</span>
              </div>
              <div className="kf-setpref">
                <div className="kf-setpref-info">
                  <strong>Sign Out</strong>
                  <span>Sign out of your account on this device</span>
                </div>
                <Link
                  href="/api/auth/signout"
                  style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--t3)', textDecoration: 'none',
                    border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: '7px 16px',
                  }}
                >
                  Sign Out
                </Link>
              </div>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.card}</div>
                <div>
                  <h2>Payment Methods</h2>
                  <p>Manage your saved payment methods.</p>
                </div>
              </div>
              {hasStripeCustomer && <BillingPortalButton />}
            </div>
            <div className="kf-setpanel-body">
              <p style={{ fontSize: 14, color: 'var(--t3)' }}>
                {hasStripeCustomer
                  ? 'Manage your saved cards and bank accounts through the Stripe billing portal.'
                  : 'No payment method on file. Upgrade to a paid plan to add one.'}
              </p>
              {!hasStripeCustomer && (
                <Link
                  href="/pricing"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    fontSize: 13, fontWeight: 750, color: 'var(--green)', textDecoration: 'none',
                  }}
                >
                  View plans {Ico.arrow}
                </Link>
              )}
            </div>
          </div>
        );

      case 'email-templates':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.mail}</div>
                <div>
                  <h2>Email Templates</h2>
                  <p>Customise the emails sent to your donors.</p>
                </div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <p style={{ fontSize: 14, color: 'var(--t3)' }}>
                Custom email templates are available on the Pro plan.
              </p>
              {currentPlan !== 'pro' && (
                <Link
                  href="/pricing"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    fontSize: 13, fontWeight: 750, color: 'var(--green)', textDecoration: 'none',
                  }}
                >
                  Upgrade to Pro {Ico.arrow}
                </Link>
              )}
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.shield}</div>
                <div>
                  <h2>Privacy</h2>
                  <p>Control how your data is used and shared.</p>
                </div>
              </div>
              <button
                type="button"
                className="kf-setpanel-save"
                onClick={saveGeneral}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            <div className="kf-setpanel-body">
              <PrefRow
                id={`${uid}-spp2`}
                label="Show Public Profile"
                desc="Allow your profile to appear in KindFund search results"
                checked={showPublicProfile}
                onChange={setShowPublicProfile}
              />
              <PrefRow
                id={`${uid}-cr2`}
                label="Campaign Recommendations"
                desc="Receive personalised campaign improvement tips by email"
                checked={campaignRecs}
                onChange={setCampaignRecs}
              />
            </div>
          </div>
        );

      case 'billing':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.crown}</div>
                <div>
                  <h2>Billing &amp; Plan</h2>
                  <p>Manage your subscription and billing history.</p>
                </div>
              </div>
              {hasStripeCustomer && <BillingPortalButton />}
            </div>
            <div className="kf-setpanel-body">
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px', background: 'var(--s3)', borderRadius: 'var(--r)',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    {Ico.crown}
                    <strong style={{ fontSize: 16 }}>{planInfo.label} Plan</strong>
                    <span className={`kf-plan-chip ${planInfo.chipClass}`}>Current</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>
                    {currentPlan === 'free'
                      ? '1 active campaign · Basic features · Email support'
                      : currentPlan === 'starter'
                      ? 'Up to 5 campaigns · Custom URL · Social sharing'
                      : 'Unlimited campaigns · Advanced analytics · Custom branding'}
                  </p>
                </div>
              </div>
              {currentPlan !== 'pro' && (
                <div style={{ marginTop: 16, padding: '18px', background: 'linear-gradient(135deg,var(--s3),var(--s4))', border: '1px solid var(--b2)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>Upgrade to KindFund Pro</strong>
                    <p style={{ fontSize: 13, color: 'var(--t2)', margin: '4px 0 0' }}>
                      Unlimited campaigns, custom branding, AI tools, and priority support.
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, background: 'var(--green)', color: '#fff', textDecoration: 'none', borderRadius: 'var(--r)', padding: '10px 20px', whiteSpace: 'nowrap' }}
                  >
                    Upgrade Now
                  </Link>
                </div>
              )}
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.download}</div>
                <div>
                  <h2>Data &amp; Export</h2>
                  <p>Download your data or delete your account.</p>
                </div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <div className="kf-setpref">
                <div className="kf-setpref-info">
                  <strong>Export Donations CSV</strong>
                  <span>Download a full history of all donations to your campaigns</span>
                </div>
                <Link
                  href="/api/exports/donations"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {Ico.download} Download
                </Link>
              </div>
              <div className="kf-setpref">
                <div className="kf-setpref-info">
                  <strong>Export Donors CSV</strong>
                  <span>Download a list of all donors across your campaigns</span>
                </div>
                <Link
                  href="/api/exports/donors"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {Ico.download} Download
                </Link>
              </div>
              <div className="kf-setpref" style={{ borderBottom: 0 }}>
                <div className="kf-setpref-info">
                  <strong style={{ color: 'var(--red)' }}>Delete Account</strong>
                  <span>Permanently delete your account and all data — this cannot be undone</span>
                </div>
                <button
                  type="button"
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 'var(--r)', padding: '7px 16px', cursor: 'pointer' }}
                  onClick={() => alert('Please contact support@kindfund.com to delete your account.')}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        );

      case 'advanced':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.sliders}</div>
                <div>
                  <h2>Advanced</h2>
                  <p>Developer options and advanced configuration.</p>
                </div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <p style={{ fontSize: 14, color: 'var(--t3)' }}>
                API access and webhook configuration are available on the Pro plan.
              </p>
              {currentPlan !== 'pro' && (
                <Link
                  href="/pricing"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 750, color: 'var(--green)', textDecoration: 'none' }}
                >
                  Upgrade to Pro {Ico.arrow}
                </Link>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <>
      <div className="kf-settings-v2">
        {/* Left nav */}
        <nav className="kf-setnav">
          {navGroups.map((grp) => (
            <div className="kf-setnav-section" key={grp.label}>
              <div className="kf-setnav-label">{grp.label}</div>
              {grp.items.map((item) => (
                <NavItem
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  active={section === item.id}
                  onClick={() => setSection(item.id)}
                />
              ))}
              <hr className="kf-setnav-divider" />
            </div>
          ))}
          <div className="kf-setnav-footer">
            <a href="mailto:support@kindfund.com" className="kf-setnav-help">
              {Ico.help} Need Help? Contact Support
            </a>
          </div>
        </nav>

        {/* Main content */}
        <div className="kf-setmain">{renderPanel()}</div>

        {/* Right panel */}
        <aside className="kf-setright">
          {/* Quick Links */}
          <div className="kf-setright-card">
            <div className="kf-setright-head">{Ico.link} Quick Links</div>
            <div className="kf-setright-body">
              {[
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/dashboard/campaigns', label: 'My Campaigns' },
                { href: '/dashboard/payouts', label: 'Payouts' },
                { href: '/dashboard/analytics', label: 'Analytics' },
                { href: '/pricing', label: 'Upgrade Plan' },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="kf-quick-link">
                  {Ico.arrow} {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Plan & Usage */}
          <div className="kf-setright-card">
            <div className="kf-setright-head">{Ico.crown} Plan &amp; Usage</div>
            <div className="kf-setright-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--t2)' }}>Current Plan</span>
                <span className={`kf-plan-chip ${planInfo.chipClass}`}>{planInfo.label}</span>
              </div>
              <div className="kf-usage-row">
                <label>
                  Active Campaigns
                  <strong>
                    {campaignsCount} / {planInfo.campaignLimit >= 999 ? '∞' : planInfo.campaignLimit}
                  </strong>
                </label>
                <div className="kf-plan-bar">
                  <div
                    className={`kf-plan-bar-fill${campaignPct >= 80 ? ' warn' : ''}`}
                    style={{ width: `${Math.min(campaignPct, 100)}%` }}
                  />
                </div>
              </div>
              {currentPlan !== 'pro' && (
                <Link
                  href="/pricing"
                  style={{
                    display: 'block', marginTop: 14, textAlign: 'center', fontSize: 13,
                    fontWeight: 750, color: '#fff', background: 'var(--green)',
                    borderRadius: 8, padding: '9px 0', textDecoration: 'none',
                  }}
                >
                  Upgrade Plan
                </Link>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="kf-setright-card">
            <div className="kf-setright-head">{Ico.check} System Status</div>
            <div className="kf-setright-body">
              {[
                'Payment Processing',
                'Email Notifications',
                'Analytics Pipeline',
                'API Services',
              ].map((svc) => (
                <div key={svc} className="kf-status-row">
                  <span>{svc}</span>
                  <span className="kf-status-ok">Operational</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`kf-set-toast ${toast.kind}`}>
          {toast.kind === 'success' ? Ico.check : null}
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function SetField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`kf-setfield${className ? ` ${className}` : ''}`}>
      <label>{label}</label>
      {children}
      {hint ? <span className="kf-setfield-hint">{hint}</span> : null}
    </div>
  );
}

function PrefRow({
  id,
  label,
  desc,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="kf-setpref">
      <div className="kf-setpref-info">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

function NotifRow({
  id,
  label,
  desc,
  defaultOn,
}: {
  id: string;
  label: string;
  desc: string;
  defaultOn: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="kf-setpref">
      <div className="kf-setpref-info">
        <strong>{label}</strong>
        <span>{desc}</span>
      </div>
      <Toggle id={id} checked={on} onChange={setOn} />
    </div>
  );
}
