'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase-browser';
import { safeNextPath } from '../../../lib/auth-config';

// ─────────────────────────────────────────────────────────────────────────────
// Second-factor challenge.
//
// Enrolling TOTP previously bought the user nothing: Supabase issues a password
// sign-in at aal1, and reaching aal2 requires the app to both challenge the
// factor and refuse aal1 sessions. Nothing did either, so "Two-Factor
// Authentication — add an extra layer of security" was decorative.
//
// This is the challenge half. The middleware sends an aal1 session here whenever
// `getAuthenticatorAssuranceLevel()` reports `nextLevel === 'aal2'` — which
// Supabase only says when the user actually has a verified factor, so users
// without 2FA never reach this page.
// ─────────────────────────────────────────────────────────────────────────────

function MfaChallenge() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));

  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (!active) return;
      if (err) { setError(err.message); setLoading(false); return; }
      const verified = data?.totp?.find((f) => f.status === 'verified');
      // No verified factor means there is nothing to challenge — don't strand
      // the user on a page they can't complete.
      if (!verified) { router.replace(next); return; }
      setFactorId(verified.id);
      setLoading(false);
    });
    return () => { active = false; };
  }, [supabase, router, next]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setBusy(true);
    setError('');
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) { setError(cErr.message); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: challenge.id, code,
      });
      if (vErr) { setError(vErr.message); return; }
      // Session is now aal2. Full reload so the middleware re-evaluates with the
      // elevated token rather than a client-side transition reusing the old one.
      window.location.assign(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign('/login');
  }

  return (
    <div className="mktg-page flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <h1 className="text-3xl font-black">Two-factor authentication</h1>
        <p className="mt-2 text-slate-600">
          Enter the 6-digit code from your authenticator app to finish signing in.
        </p>

        <label htmlFor="mfa-code" className="sr-only">Six-digit authentication code</label>
        <input
          id="mfa-code"
          className="mt-6 w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          disabled={loading || busy}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-describedby={error ? 'mfa-error' : undefined}
          aria-invalid={error ? true : undefined}
        />

        {error && (
          <p id="mfa-error" role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || busy || code.length !== 6}
          aria-busy={busy}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
        >
          {busy ? 'Verifying…' : 'Verify and continue'}
        </button>

        <button
          type="button"
          onClick={signOut}
          className="mt-4 w-full text-sm font-bold text-slate-500 underline"
        >
          Sign in as a different user
        </button>
      </form>
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense fallback={null}>
      <MfaChallenge />
    </Suspense>
  );
}
