'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase-browser';

type InviteInfo = {
  email: string;
  campaigns: { title: string; slug: string };
};

function AcceptForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'expired'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      // Use a microtask to avoid setting state synchronously inside effect
      Promise.resolve().then(() => {
        setLoadState('error');
        setErrMsg('No invite token found.');
      });
      return;
    }
    fetch(`/api/beneficiaries/invites?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((d: { invite?: InviteInfo; error?: string }) => {
        if (d.invite) { setInvite(d.invite); setLoadState('ready'); }
        else if (d.error?.toLowerCase().includes('expir')) { setLoadState('expired'); }
        else { setLoadState('error'); setErrMsg(d.error ?? 'Invalid invite.'); }
      })
      .catch(() => { setLoadState('error'); setErrMsg('Network error. Please try again.'); });
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const next = encodeURIComponent(`/beneficiary/accept?token=${token}`);
      router.push(`/login?next=${next}&mode=signup`);
      return;
    }

    const res = await fetch('/api/beneficiaries/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (res.ok) {
      setDone(true);
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setErrMsg(d.error ?? 'Failed to accept invite.');
      setAccepting(false);
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>You&apos;re set as a beneficiary!</h1>
        <p style={{ color: 'var(--t3)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.7 }}>
          You can now follow the fundraiser raising money for you — what&apos;s been raised, and
          whether any funds have been paid out yet.
        </p>
        {/* Was /dashboard/payouts, which scopes every query by user_id (the campaign
            OWNER) — a beneficiary landed there and saw an empty dashboard. */}
        <Link href="/dashboard/beneficiary" style={{ padding: '14px 28px', background: 'var(--violet)', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
          View your campaigns →
        </Link>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💚</div>
        <p style={{ color: 'var(--t3)' }}>Loading invitation…</p>
      </div>
    );
  }

  if (loadState === 'expired') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏰</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Invitation Expired</h1>
        <p style={{ color: 'var(--t3)', fontSize: 14, margin: '0 0 20px' }}>This invite link has expired. Please ask the organizer to resend it.</p>
        <Link href="/" style={{ padding: '10px 24px', background: 'var(--violet)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Go to CharitMe
        </Link>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Invalid Invitation</h1>
        <p style={{ color: 'var(--t3)', fontSize: 14, margin: '0 0 20px' }}>{errMsg || 'This invitation link is no longer valid.'}</p>
        <Link href="/" style={{ padding: '10px 24px', background: 'var(--violet)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
          Go to CharitMe
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px' }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 20, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.06)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💚</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 10px', color: 'var(--t1)' }}>
          You&apos;ve been invited to receive funds
        </h1>
        {invite && (
          <p style={{ color: 'var(--brand-text)', fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>
            {invite.campaigns?.title}
          </p>
        )}
        <p style={{ color: 'var(--t3)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.7 }}>
          Someone has started a fundraiser for you on CharitMe. Accept below to connect your bank account and receive payouts.
        </p>

        <div style={{ background: 'var(--s2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-text)', textTransform: 'uppercase', marginBottom: 8 }}>How it works</div>
          {[
            'Click "Accept" below (sign in or create a free account)',
            'Connect your bank via Stripe (2–3 minutes)',
            'Receive payouts as donations come in',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', minWidth: 0, gap: 10, alignItems: 'flex-start', marginBottom: 8, fontSize: 13, color: 'var(--t2)' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--violet)', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </span>
              {step}
            </div>
          ))}
        </div>

        {errMsg && (
          <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{errMsg}</p>
        )}

        <button
          type="button"
          onClick={handleAccept}
          disabled={accepting}
          style={{
            width: '100%', padding: '16px', border: 0, borderRadius: 12,
            background: 'linear-gradient(135deg,var(--violet),#4d1ee0)',
            color: '#fff', fontSize: 16, fontWeight: 900, cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(108,53,255,.35)',
            opacity: accepting ? 0.7 : 1,
          }}
        >
          {accepting ? 'Processing…' : 'Accept & Set Up Account →'}
        </button>

        <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 16 }}>
          Free · 0% platform fee · Powered by Stripe
        </p>
      </div>
    </div>
  );
}

export default function BeneficiaryAcceptPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💚</div>
        <p style={{ color: 'var(--t3)' }}>Loading invitation…</p>
      </div>
    }>
      <AcceptForm />
    </Suspense>
  );
}
