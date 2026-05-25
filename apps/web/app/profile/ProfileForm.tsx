'use client';
import React, { useState } from 'react';

type Profile = {
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  roles: string[];
};

export default function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [name, setName] = useState(profile.full_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

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
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-2xl font-black text-emerald-700">
            {initials}
          </div>
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

          {/* Account security */}
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-950">Account security</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-black text-slate-950">Password</div>
                  <div className="text-xs text-slate-500">Change your account password via email</div>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/auth/reset-password', { method: 'POST' });
                    if (res.ok) alert('Password reset link sent to ' + email);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                >
                  Send reset link
                </button>
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
