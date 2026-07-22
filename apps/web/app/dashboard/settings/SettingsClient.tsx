'use client';

import React, { useState, useId, useRef } from 'react';
import Link from 'next/link';
import BillingPortalButton from './BillingPortalButton';
import { SUPPORTED_CURRENCIES } from '@shared/currencies';
import { SUPPORTED_LOCALES } from '../../../lib/i18n';

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
  notification_email: boolean | null;
  notification_marketing: boolean | null;
}

interface Props {
  initialProfile: ProfileData;
  campaignsCount: number;
  userEmail: string;
  userId: string;
  hasStripeCustomer: boolean;
}

type Section =
  | 'profile'
  | 'preferences'
  | 'notifications'
  | 'security'
  | 'integrations'
  | 'team'
  | 'billing'
  | 'data';

interface Toast {
  kind: 'success' | 'error';
  msg: string;
}

// ─────────────────────────────────────────────
// Plan helpers
// ─────────────────────────────────────────────
const PLAN_LABELS: Record<string, { label: string; chipClass: string; price: string; campaignLimit: number }> = {
  free:    { label: 'Free',    chipClass: 'free',    price: '$0/month',   campaignLimit: 1  },
  starter: { label: 'Starter', chipClass: 'starter', price: '$29/month',  campaignLimit: 5  },
  pro:     { label: 'Pro',     chipClass: 'pro',     price: '$89/month',  campaignLimit: 999 },
};

// ─────────────────────────────────────────────
// Toggle
// ─────────────────────────────────────────────
function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label className="kf-toggle-wrap" htmlFor={id} style={{ cursor: 'pointer' }}>
      <input id={id} type="checkbox" className="kf-toggle-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="kf-toggle-track" />
    </label>
  );
}

// ─────────────────────────────────────────────
// NavItem
// ─────────────────────────────────────────────
function NavItem({ label, desc, icon, active, onClick }: { label: string; desc?: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`kf-setnav-item${active ? ' active' : ''}`} onClick={onClick} style={{ flexDirection: 'column', alignItems: 'flex-start', height: 'auto', paddingTop: 10, paddingBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%' }}>
        {icon}
        <span style={{ fontWeight: active ? 950 : 750, fontSize: 13 }}>{label}</span>
      </div>
      {desc && <span style={{ fontSize: 11, color: active ? 'var(--violet)' : 'var(--t3)', paddingLeft: 24, marginTop: 2, lineHeight: 1.3 }}>{desc}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────
// Inline SVGs
// ─────────────────────────────────────────────
const Ico = {
  user: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><circle cx="10" cy="7" r="3.5"/><path d="M3 18c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>,
  sliders: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><path d="M4 6h12M4 10h12M4 14h12"/><circle cx="8" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="14" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="14" r="1.5" fill="currentColor" stroke="none"/></svg>,
  bell: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><path d="M10 2a6 6 0 0 1 6 6c0 3 1 4 2 5H2c1-1 2-2 2-5a6 6 0 0 1 6-6z"/><path d="M8 17a2 2 0 0 0 4 0"/></svg>,
  lock: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><rect x="4" y="9" width="12" height="9" rx="2"/><path d="M7 9V7a3 3 0 0 1 6 0v2"/></svg>,
  link: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><path d="M8 12l-2 2a3 3 0 1 0 4.24 4.24l2-2a3 3 0 0 0-4.24-4.24z"/><path d="M12 8l2-2a3 3 0 1 0-4.24-4.24L7.76 3.76A3 3 0 0 0 12 8z"/><path d="M9 11l2-2"/></svg>,
  team: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><circle cx="7" cy="7" r="3"/><path d="M1 17a6 6 0 0 1 12 0"/><circle cx="15" cy="8" r="2.5"/><path d="M12 16a5 5 0 0 1 6.5 2"/></svg>,
  crown: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><path d="M3 15h14M3 15l2-8 5 4 5-4 2 8H3z"/></svg>,
  download: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><path d="M10 3v10M6 9l4 4 4-4"/><path d="M3 15h14"/></svg>,
  check: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} width={15} height={15}><path d="M4 10l5 5 7-8"/></svg>,
  arrow: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={14} height={14}><path d="M5 10h10M11 6l4 4-4 4"/></svg>,
  help: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><circle cx="10" cy="10" r="8"/><path d="M8 8a2 2 0 1 1 2 2v2"/><circle cx="10" cy="15" r=".8" fill="currentColor" stroke="none"/></svg>,
  org: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} width={15} height={15}><rect x="2" y="7" width="16" height="11" rx="2"/><path d="M6 7V5a4 4 0 0 1 8 0v2"/></svg>,
};

// ─────────────────────────────────────────────
// SetField
// ─────────────────────────────────────────────
function SetField({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`kf-setfield${className ? ` ${className}` : ''}`}>
      <label>{label}</label>
      {children}
      {hint ? <span className="kf-setfield-hint">{hint}</span> : null}
    </div>
  );
}

// ─────────────────────────────────────────────
// PrefRow
// ─────────────────────────────────────────────
function PrefRow({ id, label, desc, checked, onChange }: { id: string; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="kf-setpref">
      <div className="kf-setpref-info"><strong>{label}</strong><span>{desc}</span></div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

// ─────────────────────────────────────────────
// NotifRow (self-contained toggle state)
// ─────────────────────────────────────────────
function NotifRow({ id, label, desc, defaultOn }: { id: string; label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="kf-setpref">
      <div className="kf-setpref-info"><strong>{label}</strong><span>{desc}</span></div>
      <Toggle id={id} checked={on} onChange={setOn} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function SettingsClient({ initialProfile, campaignsCount, userEmail, userId, hasStripeCustomer }: Props) {
  const uid = useId();
  const [section, setSection] = useState<Section>('profile');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Form state
  const [fullName, setFullName] = useState(initialProfile.full_name ?? '');
  const [bio, setBio] = useState(initialProfile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url ?? '');
  const [orgName, setOrgName] = useState(initialProfile.org_name ?? '');
  const [orgWebsite, setOrgWebsite] = useState(initialProfile.org_website ?? '');
  const [orgTagline, setOrgTagline] = useState(initialProfile.org_tagline ?? '');
  const [timezone, setTimezone] = useState(initialProfile.timezone ?? 'America/New_York');
  const [currency, setCurrency] = useState(initialProfile.currency ?? 'usd');
  const [language, setLanguage] = useState(initialProfile.language ?? 'en');
  const [showPublicProfile, setShowPublicProfile] = useState(initialProfile.show_public_profile ?? true);
  const [campaignRecs, setCampaignRecs] = useState(initialProfile.campaign_recommendations ?? true);
  const [notifyEmail, setNotifyEmail] = useState(initialProfile.notification_email ?? true);
  const [notifyMarketing, setNotifyMarketing] = useState(initialProfile.notification_marketing ?? false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/profile-image', { method: 'POST', body: formData });
      if (!res.ok) { const d = await res.json().catch(() => ({})); showToast('error', (d as { error?: string }).error ?? 'Upload failed.'); return; }
      const { url } = await res.json() as { url: string };
      setAvatarUrl(url);
      showToast('success', 'Photo uploaded! Click Save Changes to apply.');
    } catch { showToast('error', 'Upload failed. Please try again.'); } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  }

  const currentPlan = (initialProfile.plan ?? 'free').toLowerCase();
  const planInfo = PLAN_LABELS[currentPlan] ?? PLAN_LABELS.free;
  const campaignPct = planInfo.campaignLimit >= 999
    ? Math.min((campaignsCount / 20) * 100, 100)
    : Math.min((campaignsCount / planInfo.campaignLimit) * 100, 100);

  function showToast(kind: 'success' | 'error', msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName, bio: bio || null, avatar_url: avatarUrl || null,
          org_name: orgName || null, org_website: orgWebsite || null, org_tagline: orgTagline || null,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); showToast('error', (e as { error?: string }).error ?? 'Failed to save.'); return; }
      showToast('success', 'Profile saved!');
    } catch { showToast('error', 'Something went wrong.'); } finally { setSaving(false); }
  }

  async function savePreferences() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone, currency, language, show_public_profile: showPublicProfile,
          campaign_recommendations: campaignRecs, notification_marketing: notifyMarketing,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); showToast('error', (e as { error?: string }).error ?? 'Failed to save.'); return; }
      showToast('success', 'Preferences saved!');
    } catch { showToast('error', 'Something went wrong.'); } finally { setSaving(false); }
  }

  async function saveNotifications() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_email: notifyEmail }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); showToast('error', (e as { error?: string }).error ?? 'Failed to save.'); return; }
      showToast('success', 'Notification settings saved!');
    } catch { showToast('error', 'Something went wrong.'); } finally { setSaving(false); }
  }

  const navItems: { id: Section; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'profile',       label: 'Profile & Organization',  desc: 'Manage profile and org details',    icon: Ico.user },
    { id: 'preferences',   label: 'Preferences',             desc: 'Customize your app experience',     icon: Ico.sliders },
    { id: 'notifications', label: 'Notifications',           desc: 'How you receive notifications',     icon: Ico.bell },
    { id: 'security',      label: 'Security & Privacy',      desc: 'Keep your account secure',          icon: Ico.lock },
    { id: 'integrations',  label: 'Integrations',            desc: 'Connect third-party services',      icon: Ico.link },
    { id: 'team',          label: 'Team & Access',           desc: 'Manage team members and roles',     icon: Ico.team },
    { id: 'billing',       label: 'Billing & Subscription',  desc: 'Manage your plan and billing',      icon: Ico.crown },
    { id: 'data',          label: 'Data & Export',           desc: 'Export or delete your data',        icon: Ico.download },
  ];

  // ─────────────────────────────────────────────
  // Panel renderer
  // ─────────────────────────────────────────────
  function renderPanel() {
    switch (section) {
      case 'profile':
        return (
          <>
            {/* Profile */}
            <div className="kf-setpanel">
              <div className="kf-setpanel-head">
                <div className="kf-setpanel-title">
                  <div className="kf-setpanel-icon">{Ico.user}</div>
                  <div><h2>Profile</h2><p>Your personal name, email, bio, and avatar.</p></div>
                </div>
                <button type="button" className="kf-setpanel-save" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
              <div className="kf-setpanel-body">
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : 'linear-gradient(135deg,rgba(109,53,255,.14),var(--violet))', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {!avatarUrl && (fullName.charAt(0) || userEmail.charAt(0)).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{fullName || userEmail}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{userEmail}</div>
                    <input
                      ref={avatarFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={handleAvatarFileChange}
                    />
                    <button
                      type="button"
                      style={{ marginTop: 8, height: 32, padding: '0 14px', border: '1px solid var(--b1)', borderRadius: 8, background: 'var(--s1)', fontSize: 12, fontWeight: 600, cursor: avatarUploading ? 'wait' : 'pointer', opacity: avatarUploading ? 0.6 : 1 }}
                      disabled={avatarUploading}
                      onClick={() => avatarFileRef.current?.click()}
                    >
                      {avatarUploading ? 'Uploading…' : 'Change Photo'}
                    </button>
                  </div>
                </div>
                <div className="kf-setrow">
                  <SetField label="Full Name">
                    <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" maxLength={120} />
                  </SetField>
                  <SetField label="Email Address" hint="Contact support to change your email">
                    <input value={userEmail} disabled style={{ background: 'var(--s2)', color: 'var(--t3)' }} />
                  </SetField>
                </div>
                <SetField label="Bio" className="full">
                  <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell donors a bit about yourself…" maxLength={500} />
                </SetField>
                <SetField label="Avatar URL" hint="Paste a direct image URL (HTTPS)" className="full">
                  <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://example.com/photo.jpg" type="url" />
                </SetField>
              </div>
            </div>
            {/* Organization */}
            <div className="kf-setpanel">
              <div className="kf-setpanel-head">
                <div className="kf-setpanel-title">
                  <div className="kf-setpanel-icon">{Ico.org}</div>
                  <div><h2>Organization Details</h2><p>Your public-facing organisation information.</p></div>
                </div>
                <button type="button" className="kf-setpanel-save" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
              <div className="kf-setpanel-body">
                <div className="kf-setrow">
                  <SetField label="Organization Name">
                    <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Hope Foundation" maxLength={120} />
                  </SetField>
                  <SetField label="Website">
                    <input value={orgWebsite} onChange={e => setOrgWebsite(e.target.value)} placeholder="https://yourorg.com" type="url" />
                  </SetField>
                </div>
                <SetField label="Tagline" className="full">
                  <input value={orgTagline} onChange={e => setOrgTagline(e.target.value)} placeholder="A short mission statement…" maxLength={200} />
                </SetField>
                <SetField label="Country" className="full">
                  <select defaultValue="us"><option value="us">United States</option><option value="gb">United Kingdom</option><option value="ca">Canada</option><option value="au">Australia</option></select>
                </SetField>
              </div>
            </div>
          </>
        );

      case 'preferences':
        return (
          <>
            <div className="kf-setpanel">
              <div className="kf-setpanel-head">
                <div className="kf-setpanel-title">
                  <div className="kf-setpanel-icon">{Ico.sliders}</div>
                  <div><h2>Dashboard Preferences</h2><p>Customize your app experience.</p></div>
                </div>
                <button type="button" className="kf-setpanel-save" onClick={savePreferences} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
              <div className="kf-setpanel-body">
                <div className="kf-setrow">
                  <SetField label="Default Dashboard View">
                    <select defaultValue="overview"><option value="overview">Overview</option><option value="analytics">Analytics</option><option value="campaigns">Campaigns</option></select>
                  </SetField>
                  <SetField label="Default Date Range">
                    <select defaultValue="month"><option value="week">This Week</option><option value="month">This Month</option><option value="quarter">This Quarter</option></select>
                  </SetField>
                </div>
                <div className="kf-setrow triple">
                  <SetField label="Language">
                    <select value={language} onChange={e => setLanguage(e.target.value)}>
                      {SUPPORTED_LOCALES.map(l => (
                        <option key={l.code} value={l.code}>{l.name} ({l.nativeName})</option>
                      ))}
                    </select>
                  </SetField>
                  <SetField label="Timezone">
                    <select value={timezone} onChange={e => setTimezone(e.target.value)}>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                    </select>
                  </SetField>
                  <SetField label="Currency">
                    <select value={currency} onChange={e => setCurrency(e.target.value)}>
                      {SUPPORTED_CURRENCIES.map(c => (
                        <option key={c.code} value={c.code.toLowerCase()}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </SetField>
                </div>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 12 }}>Email Preferences</div>
                  <PrefRow id={`${uid}-updates`} label="Product updates" desc="News about new CharitMe features" checked={false} onChange={() => null} />
                  <PrefRow id={`${uid}-tips`} label="Tips and best practices" desc="Guides and strategies for fundraising" checked={false} onChange={() => null} />
                  <PrefRow id={`${uid}-digest`} label="Weekly performance summary" desc="Weekly email with campaign stats" checked={campaignRecs} onChange={setCampaignRecs} />
                </div>
              </div>
            </div>
          </>
        );

      case 'notifications':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.bell}</div>
                <div><h2>Notifications</h2><p>Manage how you receive notifications.</p></div>
              </div>
              <button type="button" className="kf-setpanel-save" onClick={saveNotifications} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
            <div className="kf-setpanel-body">
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>In-App Notifications</div>
              <NotifRow id={`${uid}-n1`} label="New donations" desc="When a donor contributes to your campaign" defaultOn={true} />
              <NotifRow id={`${uid}-n2`} label="New donors" desc="When someone makes their first donation" defaultOn={true} />
              <NotifRow id={`${uid}-n3`} label="Campaign updates" desc="When your campaign reaches a milestone" defaultOn={true} />
              <NotifRow id={`${uid}-n4`} label="Payouts and transfers" desc="When payouts are processed or transferred" defaultOn={true} />
              <NotifRow id={`${uid}-n5`} label="Mentions and comments" desc="When someone mentions you or comments" defaultOn={false} />
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', margin: '18px 0 8px' }}>Email Notifications</div>
              <NotifRow id={`${uid}-ne1`} label="Receive email notifications" desc="Get notified by email for important events" defaultOn={true} />
              <SetField label="Email Frequency">
                <select defaultValue="instant"><option value="instant">Instant</option><option value="daily">Daily Digest</option><option value="weekly">Weekly</option></select>
              </SetField>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.lock}</div>
                <div><h2>Security & Privacy</h2><p>Keep your account secure.</p></div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <div className="kf-setpref">
                <div className="kf-setpref-info"><strong>Change Password</strong><span>Update your account login password</span></div>
                <Link href="/forgot-password" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', textDecoration: 'none' }}>Update Password</Link>
              </div>
              <div className="kf-setpref">
                <div className="kf-setpref-info"><strong>Two-Factor Authentication</strong><span>Add an extra layer of security to your account</span></div>
                <Link href="/dashboard/settings/mfa" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', border: '1px solid var(--b1)', borderRadius: 8, padding: '7px 16px', background: 'var(--s1)', textDecoration: 'none', display: 'inline-block' }}>Manage 2FA</Link>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', margin: '16px 0 10px' }}>Privacy</div>
              <div className="kf-setpref">
                <div className="kf-setpref-info"><strong>Profile Visibility</strong><span>Who can see your giving activity on the leaderboard and donor walls</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {showPublicProfile && (
                    <Link href={`/donors/${userId}`} target="_blank" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', textDecoration: 'none' }}>
                      Preview →
                    </Link>
                  )}
                  <select value={showPublicProfile ? 'public' : 'private'} onChange={e => setShowPublicProfile(e.target.value === 'public')} style={{ height: 36, border: '1px solid var(--b1)', borderRadius: 8, padding: '0 12px', fontSize: 13 }}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
              <div className="kf-setpref" style={{ borderBottom: 0 }}>
                <div className="kf-setpref-info"><strong>Sign Out</strong><span>Sign out of this device</span></div>
                <Link href="/api/auth/signout" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', textDecoration: 'none', border: '1px solid var(--b2)', borderRadius: 'var(--r)', padding: '7px 16px' }}>Sign Out</Link>
              </div>
            </div>
          </div>
        );

      case 'integrations':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.link}</div>
                <div><h2>Integrations</h2><p>Connect third-party services to your account.</p></div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 12 }}>Connected</div>
              {hasStripeCustomer ? (
                <div className="kf-setpref">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#6772e515', border: '1px solid #6772e530', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, color: '#6772e5', flexShrink: 0 }}>S</div>
                    <div className="kf-setpref-info"><strong>Stripe</strong><span>Payment processing</span></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'rgba(18,166,83,.14)', padding: '3px 10px', borderRadius: 999 }}>Connected</span>
                    <BillingPortalButton />
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--t3)', padding: '8px 0' }}>No integrations connected yet.</p>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', margin: '16px 0 12px' }}>Available</div>
              {[
                { name: 'Facebook Pixel', desc: 'Conversion tracking', color: '#1877f2' },
                { name: 'Slack', desc: 'Team notifications', color: '#4a154b' },
                { name: 'Zapier', desc: 'Automation workflows', color: '#ff4a00' },
                { name: 'Mailchimp', desc: 'Email marketing', color: '#f5a623' },
                { name: 'Google Analytics', desc: 'Website analytics', color: '#ea4335' },
              ].map(i => (
                <div key={i.name} className="kf-setpref">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${i.color}15`, border: `1px solid ${i.color}30`, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700, color: i.color, flexShrink: 0 }}>{i.name.charAt(0)}</div>
                    <div className="kf-setpref-info"><strong>{i.name}</strong><span>{i.desc}</span></div>
                  </div>
                  <Link href="/dashboard/integrations" style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-text)', padding: '4px 12px', border: '1px solid var(--green)', borderRadius: 8, textDecoration: 'none' }}>Connect →</Link>
                </div>
              ))}
            </div>
          </div>
        );

      case 'team':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.team}</div>
                <div><h2>Team & Access</h2><p>Manage team members and roles.</p></div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 12 }}>Team Members</div>
              <div className="kf-setpref">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(109,53,255,.14),var(--violet))', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(initialProfile.full_name || userEmail).charAt(0).toUpperCase()}</div>
                  <div className="kf-setpref-info"><strong>{initialProfile.full_name || userEmail}</strong><span>{userEmail}</span></div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)', background: 'rgba(109,53,255,.14)', padding: '3px 10px', borderRadius: 999 }}>Owner</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--t3)', margin: '18px 0 12px' }}>Invite Team Member</div>
              <div style={{ padding: '14px 16px', background: 'var(--s3)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--t2)', margin: 0 }}>Invite collaborators and manage permissions from the Team page.</p>
                <Link href="/dashboard/team" style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: 'var(--violet)', textDecoration: 'none', background: 'rgba(109,53,255,.14)', borderRadius: 8, padding: '8px 16px', whiteSpace: 'nowrap' }}>Go to Team →</Link>
              </div>
            </div>
          </div>
        );

      case 'billing':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.crown}</div>
                <div><h2>Billing & Subscription</h2><p>Manage your plan and billing details.</p></div>
              </div>
              {hasStripeCustomer && <BillingPortalButton />}
            </div>
            <div className="kf-setpanel-body">
              {/* Current plan */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: 'var(--s3)', borderRadius: 'var(--r)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    {Ico.crown}
                    <strong style={{ fontSize: 16 }}>{planInfo.label} Plan</strong>
                    <span className={`kf-plan-chip ${planInfo.chipClass}`}>Current</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--t3)', margin: 0 }}>
                    {currentPlan === 'free' ? '1 active campaign · Basic features · Email support'
                      : currentPlan === 'starter' ? 'Up to 5 campaigns · Custom URL · Social sharing'
                      : 'Unlimited campaigns · Advanced analytics · Custom branding'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{planInfo.price}</div>
                </div>
              </div>

              {currentPlan !== 'pro' && (
                <div style={{ padding: '18px', background: 'linear-gradient(135deg,var(--s3),var(--s4))', border: '1px solid var(--b2)', borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <strong style={{ fontSize: 15 }}>Upgrade to CharitMe Pro</strong>
                    <p style={{ fontSize: 13, color: 'var(--t2)', margin: '4px 0 0' }}>Unlimited campaigns, custom branding, AI tools, and priority support.</p>
                  </div>
                  <Link href="/pricing" style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, background: 'var(--green)', color: '#fff', textDecoration: 'none', borderRadius: 'var(--r)', padding: '10px 20px', whiteSpace: 'nowrap' }}>Upgrade Now</Link>
                </div>
              )}

              {/* Payment Method */}
              <div className="kf-setpref">
                <div className="kf-setpref-info">
                  <strong>Payment Method</strong>
                  <span>{hasStripeCustomer ? 'Visa **** 4242' : 'No payment method on file'}</span>
                </div>
                {hasStripeCustomer ? <BillingPortalButton /> : <Link href="/pricing" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', textDecoration: 'none' }}>Add Method {Ico.arrow}</Link>}
              </div>

              {/* Billing history */}
              <div className="kf-setpref" style={{ borderBottom: 0 }}>
                <div className="kf-setpref-info">
                  <strong>Billing History</strong>
                  <span>View past invoices and receipts</span>
                </div>
                {hasStripeCustomer ? <BillingPortalButton /> : <span style={{ fontSize: 13, color: 'var(--t3)' }}>No history</span>}
              </div>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div className="kf-setpanel-icon">{Ico.download}</div>
                <div><h2>Data & Export</h2><p>Export your data or delete your account.</p></div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              <div className="kf-setpref">
                <div className="kf-setpref-info"><strong>Export Donations CSV</strong><span>Download a full history of all donations</span></div>
                <Link href="/api/exports/donations" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>{Ico.download} Download</Link>
              </div>
              <div className="kf-setpref">
                <div className="kf-setpref-info"><strong>Export Donors CSV</strong><span>Download a list of all donors</span></div>
                <Link href="/api/exports/donors" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>{Ico.download} Download</Link>
              </div>
              <div className="kf-setpref">
                <div className="kf-setpref-info"><strong>Export All Data</strong><span>Download a complete data export (JSON)</span></div>
                <Link href="/api/exports/full" download style={{ fontSize: 13, fontWeight: 700, color: 'var(--green-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>{Ico.download} Download Export</Link>
              </div>
              <div className="kf-setpref" style={{ borderBottom: 0 }}>
                <div className="kf-setpref-info">
                  <strong style={{ color: 'var(--red-text)' }}>Request Account Deletion</strong>
                  <span>Permanently delete your account and all data — this cannot be undone</span>
                </div>
                <a href="mailto:support@CharitMe.com?subject=Account%20Deletion%20Request" style={{ fontSize: 13, fontWeight: 700, color: 'var(--red-text)', border: '1px solid var(--red)', borderRadius: 'var(--r)', padding: '7px 16px', textDecoration: 'none', display: 'inline-block' }}>Request Deletion</a>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <>
      <div className="kf-settings-v2">
        {/* Left nav */}
        <nav className="kf-setnav">
          <div style={{ padding: '12px 14px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--t3)' }}>Settings</div>
          {navItems.map(item => (
            <NavItem key={item.id} label={item.label} desc={item.desc} icon={item.icon} active={section === item.id} onClick={() => setSection(item.id)} />
          ))}
          <div className="kf-setnav-footer">
            <a href="mailto:support@CharitMe.com" className="kf-setnav-help">{Ico.help} Need Help? Contact Support</a>
          </div>
        </nav>

        {/* Main content */}
        <div className="kf-setmain">{renderPanel()}</div>

        {/* Right panel */}
        <aside className="kf-setright">
          {/* Quick links */}
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
                <Link key={href} href={href} className="kf-quick-link">{Ico.arrow} {label}</Link>
              ))}
            </div>
          </div>

          {/* Plan & Usage */}
          <div className="kf-setright-card">
            <div className="kf-setright-head">{Ico.crown} Plan & Usage</div>
            <div className="kf-setright-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--t2)' }}>Current Plan</span>
                <span className={`kf-plan-chip ${planInfo.chipClass}`}>{planInfo.label}</span>
              </div>
              <div className="kf-usage-row">
                <label>Active Campaigns<strong>{campaignsCount} / {planInfo.campaignLimit >= 999 ? '∞' : planInfo.campaignLimit}</strong></label>
                <div className="kf-plan-bar">
                  <div className={`kf-plan-bar-fill${campaignPct >= 80 ? ' warn' : ''}`} style={{ width: `${Math.min(campaignPct, 100)}%` }} />
                </div>
              </div>
              {currentPlan !== 'pro' && (
                <Link href="/pricing" style={{ display: 'block', marginTop: 14, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--green)', borderRadius: 8, padding: '9px 0', textDecoration: 'none' }}>Upgrade Plan</Link>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="kf-setright-card">
            <div className="kf-setright-head">{Ico.check} System Status</div>
            <div className="kf-setright-body">
              {['Payment Processing', 'Email Notifications', 'Analytics Pipeline', 'API Services'].map(svc => (
                <div key={svc} className="kf-status-row"><span>{svc}</span><span className="kf-status-ok">Operational</span></div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {toast && (
        <div className={`kf-set-toast ${toast.kind}`}>
          {toast.kind === 'success' ? Ico.check : null}
          {toast.msg}
        </div>
      )}
    </>
  );
}
