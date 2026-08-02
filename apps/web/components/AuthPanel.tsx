'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../lib/supabase-browser';
import { getAuthCallbackUrl, safeNextPath } from '../lib/auth-config';

// Google OAuth is initiated server-side via /api/auth/signin so the
// PKCE code-verifier is set as an HTTP cookie (not document.cookie).
// This prevents the "PKCE code verifier not found" error caused by
// browser-client cookie storage being unavailable at callback time.

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.3.06 2.21.73 2.98.75.9-.19 1.76-.87 3.02-.94 1.29.08 2.34.68 3 1.76-2.74 1.64-2.28 5.43.5 6.55-.55 1.4-1.27 2.76-2.5 4.76ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function authErrorMessage(raw: string | null): string {
  if (!raw) return '';
  if (raw.toLowerCase().includes('pkce code verifier')) {
    return 'Your Google sign-in session expired. Please try Continue with Google again from this browser.';
  }
  return raw;
}

async function syncProfile(accessToken: string): Promise<void> {
  // Best-effort: requireUser() creates a missing profile on the first
  // protected page load, so login must never block on this call.
  await fetch('/api/auth/sync-profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

export interface AuthPanelProps {
  /** Which mode the panel opens in. `?mode=` in the URL still wins, so the
      existing /login?mode=signup links keep working unchanged. */
  defaultMode?: 'login' | 'signup';
  /** Optional benefit bullets for the marketing column (design 13). */
  benefits?: readonly string[];
}

function AuthForm({ defaultMode: initialMode = 'login', benefits }: AuthPanelProps) {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNextPath(params.get('next'));
  const defaultMode = params.get('mode') === 'signup' ? 'signup' : params.get('mode') === 'login' ? 'login' : initialMode;
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  // Pre-populate error from URL (e.g. ?error=... set by the OAuth callback route)
  const [error, setError] = useState(authErrorMessage(params.get('error')));
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.auth.getSession().then(async ({ data: sessionData }) => {
        const accessToken = sessionData.session?.access_token;
        if (accessToken) await syncProfile(accessToken);
      }).finally(() => {
        router.replace(next);
      });
    });
  }, [next, router, supabase]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${getAuthCallbackUrl()}?next=${encodeURIComponent(next)}`,
          },
        });
        if (signUpError) throw signUpError;
        setSuccess('Check your email to confirm your account, then sign in.');
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (signInData.session?.access_token) {
          await syncProfile(signInData.session.access_token);
        }
        router.replace(next);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = `/api/auth/signin?provider=google&next=${encodeURIComponent(next)}`;
  };

  const handleApple = () => {
    window.location.href = `/api/auth/signin?provider=apple&next=${encodeURIComponent(next)}`;
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSuccess('');
  };

  // Not <main>: AppShell already provides the page's single main landmark, and
  // nesting a second one trips axe's landmark-no-duplicate-main /
  // landmark-main-is-top-level. This is just the auth panel's wrapper.
  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="kind-logo auth-logo"><img src="/logo.png" alt="" className="kind-logo-img" width={34} height={34} /><strong>CharitMe</strong></div>
          <p className="auth-kicker">Secure fundraising workspace</p>
          <h1>{mode === 'login' ? 'Welcome back.' : 'Create your CharitMe account.'}</h1>
          <p>Manage campaigns, donations, payouts, updates, and supporter conversations — all in one secure CharitMe account.</p>
          {benefits && benefits.length > 0 ? (
            <ul className="auth-benefits">
              {benefits.map((benefit) => (
                <li key={benefit}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="17" height="17" fill="none"
                       stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="auth-proof">
            <span>Google OAuth</span>
            <span>Email accounts</span>
            <span>Secure sessions</span>
          </div>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div>
            <h2>{mode === 'login' ? 'Log in' : 'Start fundraising'}</h2>
            <p>{mode === 'login' ? 'Continue to your dashboard.' : 'Create a verified workspace in minutes.'}</p>
          </div>

          <button className="auth-google" type="button" onClick={handleGoogle} disabled={loading}>
            <GoogleMark />
            Continue with Google
          </button>
          <button className="auth-apple" type="button" onClick={handleApple} disabled={loading}>
            <AppleMark />
            Continue with Apple
          </button>

          <div className="auth-separator"><span>or</span></div>

          {mode === 'signup' ? (
            <label>
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Sarah Thompson" required />
            </label>
          ) : null}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required minLength={6} />
          </label>

          {mode === 'login' ? (
            <Link href="/forgot-password" className="auth-forgot">Forgot password?</Link>
          ) : null}

          {error ? <p className="auth-error">{error}</p> : null}
          {success ? <p className="auth-success">{success}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>

          <p className="auth-switch">
            {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
            <button type="button" onClick={toggleMode}>{mode === 'login' ? 'Sign up' : 'Log in'}</button>
          </p>
        </form>
      </section>
    </div>
  );
}

export default function AuthPanel(props: AuthPanelProps) {
  return (
    <Suspense fallback={<div className="auth-page" />}>
      <AuthForm {...props} />
    </Suspense>
  );
}
