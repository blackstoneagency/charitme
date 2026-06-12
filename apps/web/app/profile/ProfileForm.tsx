'use client';
import React, { useState } from 'react';
import { createClient } from '../../lib/supabase-browser';

type Profile = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  roles: string[];
  notification_email: boolean;
  notification_updates: boolean;
  notification_marketing: boolean;
};

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="text-sm font-black text-slate-950">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

export default function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [name, setName] = useState(profile.full_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [pwResetMsg, setPwResetMsg] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwChangeStatus, setPwChangeStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pwChangeError, setPwChangeError] = useState('');

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPwChangeStatus('error');
      setPwChangeError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwChangeStatus('error');
      setPwChangeError('Passwords do not match.');
      return;
    }
    setPwChangeStatus('saving');
    setPwChangeError('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwChangeStatus('error');
      setPwChangeError(error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPwChangeStatus('saved');
    setTimeout(() => setPwChangeStatus('idle'), 2500);
  }

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/profile-image', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not upload photo');
      setAvatarUrl(data.url as string);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setAvatarUploading(false);
    }
  }

  const [notifyEmail, setNotifyEmail] = useState(profile.notification_email);
  const [notifyUpdates, setNotifyUpdates] = useState(profile.notification_updates);
  const [notifyMarketing, setNotifyMarketing] = useState(profile.notification_marketing);
  const [prefStatus, setPrefStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function updatePreference(
    key: 'notification_email' | 'notification_updates' | 'notification_marketing',
    value: boolean,
    setter: (v: boolean) => void,
  ) {
    setter(value);
    setPrefStatus('saving');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error();
      setPrefStatus('saved');
      setTimeout(() => setPrefStatus('idle'), 2000);
    } catch {
      setter(!value);
      setPrefStatus('error');
      setTimeout(() => setPrefStatus('idle'), 2500);
    }
  }

  const initials = (name || email).slice(0, 2).toUpperCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setErrorMessage('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim(), bio: bio.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? 'Failed to save');
      }
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-black text-slate-950">Profile</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your account information and preferences.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Avatar + info sidebar */}
        <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <label className="group relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
            {!avatarUrl && initials}
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[11px] font-black text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
              {avatarUploading ? '…' : 'Change'}
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => void handleAvatarChange(e)} disabled={avatarUploading} />
          </label>
          {avatarError && <p className="mt-2 text-xs font-bold text-red-600">{avatarError}</p>}
          <div className="mt-3 font-black text-slate-950">{name || 'Your name'}</div>
          <div className="mt-1 text-sm text-slate-500">{email}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {profile.roles.map((role) => (
              <span key={role} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-700">
                {role}
              </span>
            ))}
          </div>
        </div>

        {/* Edit form */}
        <div className="space-y-5">
          <form onSubmit={handleSave} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="mb-6 text-lg font-black text-slate-950">Personal information</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-black text-slate-700">Display name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  maxLength={120}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-black text-slate-700">Email address</label>
                <input
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400 outline-none"
                />
                <p className="mt-1 text-xs text-slate-400">Email cannot be changed here.</p>
              </div>
            </div>
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-black text-slate-700">Bio <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short description about you or your organization…"
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <p className="mt-1 text-right text-xs text-slate-400">{bio.length}/500</p>
            </div>

            {status === 'error' && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{errorMessage}</p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button
                type="submit"
                disabled={status === 'saving'}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {status === 'saving' ? 'Saving…' : 'Save changes'}
              </button>
              {status === 'saved' && (
                <span className="text-sm font-bold text-emerald-600">✓ Saved successfully</span>
              )}
            </div>
          </form>

          {/* Email preferences */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="mb-1 text-lg font-black text-slate-950">Email preferences</h2>
            <p className="mb-4 text-sm text-slate-500">Choose which emails you&apos;d like to receive from CharitMe.</p>
            <div className="space-y-3">
              <Toggle
                checked={notifyEmail}
                onChange={(v) => void updatePreference('notification_email', v, setNotifyEmail)}
                label="Account emails"
                description="Donation receipts, recurring billing reminders, and account notices"
              />
              <Toggle
                checked={notifyUpdates}
                onChange={(v) => void updatePreference('notification_updates', v, setNotifyUpdates)}
                label="Campaign updates"
                description="News from campaigns you've supported or saved"
              />
              <Toggle
                checked={notifyMarketing}
                onChange={(v) => void updatePreference('notification_marketing', v, setNotifyMarketing)}
                label="News & promotions"
                description="Occasional tips, product news, and offers from CharitMe"
              />
            </div>
            {prefStatus === 'saved' && <p className="mt-3 text-xs font-bold text-emerald-600">✓ Preferences saved</p>}
            {prefStatus === 'error' && <p className="mt-3 text-xs font-bold text-red-600">Could not save. Please try again.</p>}
          </div>

          {/* Account security */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-950">Account security</h2>
            <div className="space-y-3">
              <form onSubmit={handlePasswordChange} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-950">Set a new password</div>
                <div className="text-xs text-slate-500">Choose a new password for your account</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-new-password" className="mb-1 block text-xs font-black text-slate-700">New password</label>
                    <input
                      id="profile-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      minLength={6}
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-confirm-password" className="mb-1 block text-xs font-black text-slate-700">Confirm password</label>
                    <input
                      id="profile-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      minLength={6}
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </div>
                {pwChangeStatus === 'error' && (
                  <p className="mt-3 text-xs font-bold text-red-600">{pwChangeError}</p>
                )}
                {pwChangeStatus === 'saved' && (
                  <p className="mt-3 text-xs font-bold text-emerald-600">✓ Password updated</p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={pwChangeStatus === 'saving' || !newPassword || !confirmPassword}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                  >
                    {pwChangeStatus === 'saving' ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              </form>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-black text-slate-950">Password</div>
                  <div className="text-xs text-slate-500">Forgot your password? Email yourself a reset link</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {pwResetMsg && <span style={{ fontSize: 11, color: 'var(--green-dark, #15803d)', fontWeight: 600 }}>{pwResetMsg}</span>}
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/auth/reset-password', { method: 'POST' });
                      if (res.ok) { setPwResetMsg(`Reset link sent to ${email}`); setTimeout(() => setPwResetMsg(''), 4000); }
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                  >
                    Send reset link
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-black text-slate-950">Sign out</div>
                  <div className="text-xs text-slate-500">Sign out of all sessions on this device</div>
                </div>
                <a
                  href="/api/auth/signout"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:border-red-300 hover:text-red-700"
                >
                  Sign out
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
