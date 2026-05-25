'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase-browser';
import { getAuthCallbackUrl, safeNextPath } from '../../lib/auth-config';
import { Btn, Input } from '../../components/ui';

export default function LoginPage() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNextPath(params.get('next'));
  const defaultMode = params.get('mode') === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name },
            emailRedirectTo: getAuthCallbackUrl(),
          },
        });
        if (err) throw err;
        setSuccess('Check your email to confirm your account, then sign in.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace(next);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${getAuthCallbackUrl()}?next=${encodeURIComponent(next)}` },
    });
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--s1)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid var(--b1)',
          borderRadius: 'var(--rxl)',
          padding: '40px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', textAlign: 'center' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--t3)', textAlign: 'center', marginBottom: '28px' }}>
            {mode === 'login' ? 'Sign in to manage your campaigns.' : 'Start raising money in minutes.'}
          </p>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            style={{
              width: '100%',
              padding: '11px',
              border: '1px solid var(--b1)',
              borderRadius: 'var(--r)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '20px',
              color: 'var(--t1)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--b1)' }} />
            <span style={{ fontSize: '12px', color: 'var(--t4)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--b1)' }} />
          </div>

          {success ? (
            <div style={{ padding: '16px', background: 'var(--green-light)', borderRadius: 'var(--r)', fontSize: '14px', color: 'var(--green-dark)', textAlign: 'center' }}>
              {success}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mode === 'signup' && (
                <Input label="Full name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
              )}
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              {error && <p style={{ fontSize: '13px', color: 'var(--red)' }}>{error}</p>}
              <Btn type="submit" loading={loading} size="lg" style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Btn>
            </form>
          )}

          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--t3)', marginTop: '20px' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}
              style={{ color: 'var(--green)', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', fontSize: '13px' }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
