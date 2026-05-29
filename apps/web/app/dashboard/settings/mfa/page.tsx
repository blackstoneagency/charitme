'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../../../lib/supabase-browser';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeApp';

type MfaFactor = {
  id: string;
  factor_type: 'totp';
  status: 'verified' | 'unverified';
  friendly_name: string | null;
};

export default function MfaPage() {
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const supabase = createClient();
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }
      setFactors((data?.totp ?? []) as MfaFactor[]);
      setLoading(false);
    }).catch((e: unknown) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'Failed to load MFA factors');
      setLoading(false);
    });
    return () => { cancelled = true; };
  // supabase is stable (created once per render cycle via createClient)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadCount]);

  function triggerReload() { setReloadCount(n => n + 1); }

  async function reloadFactors() {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.mfa.listFactors();
      if (err) { setError(err.message); return; }
      setFactors((data?.totp ?? []) as MfaFactor[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load MFA factors');
    } finally {
      setLoading(false);
    }
    triggerReload();
  }

  async function startEnroll() {
    setEnrolling(true);
    setError('');
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' });
      if (err) { setError(err.message); return; }
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  async function verifyFactor() {
    if (!verifyCode || verifyCode.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setVerifying(true);
    setError('');
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) { setError(cErr.message); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: verifyCode });
      if (vErr) { setError(vErr.message); return; }
      setQrCode(''); setSecret(''); setFactorId(''); setVerifyCode('');
      await reloadFactors();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  async function removeFactor(id: string) {
    if (!confirm('Remove this authenticator? You will no longer be required to use 2FA.')) return;
    setRemoving(id);
    try {
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (err) { setError(err.message); return; }
      await reloadFactors();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove factor');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <CharitMeShell active="Settings">
      <TopBar
        title="Two-Factor Authentication"
        subtitle="Add an extra layer of security to your account with an authenticator app."
        actions={<Link href="/dashboard/settings?section=security" className="kf-outline">← Back to Settings</Link>}
      />
      <div style={{ padding: '0 32px 40px', maxWidth: 560 }}>
        {error && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fff0f3', border: '1px solid #ffc0cb', borderRadius: 10, color: '#c0003c', fontSize: 14, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 32, color: 'var(--t3)', textAlign: 'center' }}>Loading…</div>
        ) : (
          <div className="kf-setpanel">
            <div className="kf-setpanel-head">
              <div className="kf-setpanel-title">
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#efe8ff,#6c35ff)', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" width={20} height={20} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div>
                  <h2>Authenticator App</h2>
                  <p>{factors.length > 0 ? `${factors.length} device enrolled` : 'No devices enrolled'}</p>
                </div>
              </div>
            </div>
            <div className="kf-setpanel-body">
              {factors.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {factors.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid var(--b2)', borderRadius: 10, background: '#f8f9fc' }}>
                      <div>
                        <div style={{ fontWeight: 750, fontSize: 14 }}>{f.friendly_name ?? 'Authenticator'}</div>
                        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
                          Status: <span style={{ color: f.status === 'verified' ? 'var(--green)' : '#f59e0b', fontWeight: 700 }}>{f.status === 'verified' ? 'Verified' : 'Pending'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={removing === f.id}
                        onClick={() => removeFactor(f.id)}
                        style={{ height: 34, padding: '0 14px', border: '1px solid #ffc0cb', borderRadius: 8, background: '#fff', color: '#c0003c', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {removing === f.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : qrCode ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <p style={{ fontSize: 14, color: 'var(--t2)' }}>
                    Scan the QR code below with your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code to verify.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="QR code for authenticator app" style={{ width: 200, height: 200, border: '1px solid var(--b2)', borderRadius: 10, padding: 8 }} />
                  <div style={{ fontFamily: 'monospace', fontSize: 13, background: '#f8f9fc', padding: '10px 14px', borderRadius: 8, wordBreak: 'break-all', color: 'var(--t2)' }}>
                    Manual code: <strong>{secret}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      style={{ flex: 1, height: 44, border: '1px solid var(--b2)', borderRadius: 9, padding: '0 14px', fontSize: 20, letterSpacing: 6, textAlign: 'center' }}
                    />
                    <button
                      type="button"
                      disabled={verifying}
                      onClick={verifyFactor}
                      style={{ height: 44, padding: '0 20px', border: 0, borderRadius: 9, background: '#6c35ff', color: '#fff', fontWeight: 850, fontSize: 14, cursor: 'pointer' }}
                    >
                      {verifying ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                  <button type="button" onClick={() => { setQrCode(''); setSecret(''); setFactorId(''); }} style={{ height: 36, border: '1px solid var(--b2)', borderRadius: 8, background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--t3)' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.6 }}>
                    Two-factor authentication adds a second step when signing in, making your account more secure.
                    You will need an authenticator app on your phone (Google Authenticator, Authy, 1Password).
                  </p>
                  <button
                    type="button"
                    disabled={enrolling}
                    onClick={startEnroll}
                    style={{ height: 44, border: 0, borderRadius: 9, background: 'linear-gradient(135deg,#6c35ff,#551cf2)', color: '#fff', fontWeight: 850, fontSize: 14, cursor: 'pointer', opacity: enrolling ? 0.6 : 1 }}
                  >
                    {enrolling ? 'Setting up…' : 'Set Up Authenticator App'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CharitMeShell>
  );
}
