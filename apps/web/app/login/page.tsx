'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../lib/supabase-browser';
import { getAuthCallbackUrl, safeNextPath } from '../../lib/auth-config';

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

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNextPath(params.get('next'));
  const defaultMode = params.get('mode') === 'signup' ? 'signup' : 'login';
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
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
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.replace(next);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${getAuthCallbackUrl()}?next=${encodeURIComponent(next)}` },
    });
    if (oauthError) setError(oauthError.message);
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSuccess('');
  };

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-copy">
          <div className="kind-logo auth-logo"><span><i /><b /></span><strong>KindFund</strong></div>
          <p className="auth-kicker">Secure fundraising workspace</p>
          <h1>{mode === 'login' ? 'Welcome back.' : 'Create your KindFund account.'}</h1>
          <p>Manage campaigns, donations, payouts, updates, and supporter conversations with your production Supabase account.</p>
          <div className="auth-proof">
            <span>Google OAuth</span>
            <span>Email accounts</span>
            <span>Supabase sessions</span>
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
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page" />}>
      <LoginForm />
    </Suspense>
  );
}
