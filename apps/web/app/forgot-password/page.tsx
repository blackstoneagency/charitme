'use client';
import React, { useState } from 'react';
import { createClient } from '../../lib/supabase-browser';
import { getAppOrigin } from '../../lib/auth-config';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const supabase = createClient();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${getAppOrigin()}/profile` });
    if (resetError) setError(resetError.message);
    else setMessage('Check your email for a secure password reset link.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <h1 className="text-3xl font-black">Reset password</h1>
        <p className="mt-2 text-slate-600">We will send a secure reset link to your email.</p>
        <input className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Send reset link</button>
      </form>
    </div>
  );
}
