'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BeneficiaryAcceptPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token      = params.get('token')      ?? '';
  const campaignId = params.get('campaign')   ?? '';

  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Validate the token on mount without triggering cascading renders
  const isValid = Boolean(token && campaignId);
  const errorMessage = !isValid ? 'Invalid invitation link. Please check the email and try again.' : '';

  async function handleAccept() {
    setState('loading');
    try {
      // Redirect to sign in / dashboard where they can connect Stripe Connect
      // The token is passed so the callback can mark the invite as accepted
      const next = encodeURIComponent(`/dashboard/settings?beneficiary_token=${token}&campaign=${campaignId}`);
      router.push(`/login?next=${next}&mode=signup`);
    } catch {
      setMessage('Something went wrong. Please try again or contact support.');
      setState('error');
    }
  }

  if (!isValid || (state === 'error' && message)) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Invalid or expired invitation</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>{errorMessage || message || 'This invitation link is no longer valid.'}</p>
        <Link href="/" style={{ padding: '10px 24px', background: '#6c35ff', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Go to KindFund
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px' }}>
      <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 20, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.06)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💚</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 10px', color: '#1a1a2e' }}>
          You&apos;ve been invited to receive funds
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 24px', lineHeight: 1.7 }}>
          Someone has started a fundraiser for you on KindFund. By accepting, you&apos;ll be able
          to connect your bank account and receive payouts from donations.
        </p>

        <div style={{ background: '#f7f2ff', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6c35ff', textTransform: 'uppercase', marginBottom: 8 }}>How it works</div>
          {[
            'Click "Accept & Set Up Account" below',
            'Create a free KindFund account (or sign in)',
            'Connect your bank account via Stripe (2–3 minutes)',
            'Receive payouts as donations come in',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: '#334064' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#6c35ff', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              {step}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={state === 'loading' || !token}
          style={{
            width: '100%', padding: '16px', border: 0, borderRadius: 12,
            background: 'linear-gradient(135deg,#6c35ff,#4d1ee0)',
            color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(108,53,255,.35)',
          }}
        >
          {state === 'loading' ? 'Redirecting…' : 'Accept & Set Up Account →'}
        </button>

        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
          Free to use · KindFund charges 0% platform fee · Powered by Stripe
        </p>
      </div>
    </div>
  );
}
