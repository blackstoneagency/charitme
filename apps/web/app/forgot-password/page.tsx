'use client';
import React, { useState } from 'react';
import { createClient } from '../../lib/supabase-browser';
import { getAuthCallbackUrl } from '../../lib/auth-config';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const supabase = createClient();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    // Clear both banners: without resetting `message`, a success followed by a
    // failure left the old "check your email" note sitting above the new error.
    setError('');
    setMessage('');
    setPending(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAuthCallbackUrl()}?next=${encodeURIComponent('/profile')}`,
      });
      if (resetError) setError(resetError.message);
      else setMessage('Check your email for a secure password reset link.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mktg-page flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <h1 className="text-3xl font-black">Reset password</h1>
        <p className="mt-2 text-slate-600">We will send a secure reset link to your email.</p>
        <label htmlFor="forgot-email" className="sr-only">Email address</label>
        <input id="forgot-email" className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button type="submit" disabled={pending} aria-busy={pending} className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{pending ? 'Sending…' : 'Send reset link'}</button>
      </form>
    </div>
  );
}
