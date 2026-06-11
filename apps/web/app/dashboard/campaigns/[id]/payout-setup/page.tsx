'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../../../components/CharitMeApp';
import { createClient } from '../../../../../lib/supabase-browser';

type PayoutStatus = {
  payoutReady: boolean;
  destinationRole: 'beneficiary' | 'organizer' | null;
  organizerConnected: boolean;
  beneficiaryLinked: boolean;
  beneficiaryConnected: boolean;
  beneficiaryName: string | null;
  pendingInvite: { email: string; expiresAt: string } | null;
};

export default function PayoutSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState('');
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(({ id }) => {
      setCampaignId(id);
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) { router.push('/login'); return; }
        fetch(`/api/campaigns/${id}/payout-status`)
          .then(res => res.json())
          .then((data: PayoutStatus & { error?: string }) => {
            if (!data.error) setStatus(data);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
    });
  }, [params, router]);

  async function sendInvite() {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) { setError('Enter a valid email address.'); return; }
    setSending(true); setError(''); setSent(false);
    try {
      const res = await fetch('/api/beneficiaries/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, email: inviteEmail.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to send invite.'); return; }
      setSent(true);
      setStatus(prev => prev ? { ...prev, pendingInvite: { email: inviteEmail.trim(), expiresAt: '' } } : prev);
      setInviteEmail('');
    } catch { setError('Network error. Please try again.'); }
    finally { setSending(false); }
  }

  if (loading) {
    return <CharitMeShell active="My Campaigns"><TopBar title="Payout Setup" subtitle="Loading…" /><div style={{ padding: 32, color: 'var(--t3)' }}>Loading…</div></CharitMeShell>;
  }

  const ready = status?.payoutReady ?? false;
  const role = status?.destinationRole;

  return (
    <CharitMeShell active="My Campaigns">
      <TopBar
        title="Payout Setup"
        subtitle="CharitMe never holds funds — every donation transfers instantly to the recipient's own bank account."
        actions={
          <Link href={`/dashboard/campaigns/${campaignId}`} className="kf-outline" style={{ textDecoration: 'none' }}>← Back</Link>
        }
      />

      <div className="kf-admin-dash" style={{ maxWidth: 720 }}>
        {error && <div style={{ padding: '12px 16px', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 10, color: '#be123c', fontSize: 14, fontWeight: 600 }}>⚠ {error}</div>}

        {/* Status banner */}
        <section className="kf-card" style={{ padding: 24, borderLeft: `4px solid ${ready ? 'var(--green, #19b86a)' : '#f59e0b'}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 8px' }}>
            {ready ? '✅ Donations are flowing directly to the recipient' : '⚠️ Donations are paused until payout setup completes'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, margin: 0 }}>
            {ready && role === 'beneficiary' && (
              <>Every donation transfers at the moment of payment straight to {status?.beneficiaryName || 'the beneficiary'}&apos;s
              own Stripe account. Neither you nor CharitMe ever holds the money.</>
            )}
            {ready && role === 'organizer' && (
              <>Every donation transfers at the moment of payment straight to your connected Stripe account.
              CharitMe never holds the money.</>
            )}
            {!ready && (
              <>To protect donors, CharitMe only accepts donations that can be transferred immediately to a
              verified bank account. Complete one of the two options below to open donations.</>
            )}
          </p>
        </section>

        {/* Option 1: organizer's own account */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>
            Option 1 — Receive funds yourself {status?.organizerConnected ? '✓ Connected' : ''}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Connect your own bank account through Stripe&apos;s secure identity verification.
            Takes about 3 minutes with a government ID.
          </p>
          <Link href="/dashboard/payouts" className="kf-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
            {status?.organizerConnected ? 'Manage payout account' : 'Connect bank account'} →
          </Link>
        </section>

        {/* Option 2: beneficiary */}
        <section className="kf-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 8px' }}>
            Option 2 — Send funds directly to the person you&apos;re fundraising for
            {status?.beneficiaryConnected ? ' ✓ Connected' : status?.beneficiaryLinked ? ' (invited — bank pending)' : ''}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Fundraising on someone&apos;s behalf? Invite them as the beneficiary. They verify their identity and
            connect their own bank — then every donation skips you entirely and lands in their account.
            This is the most transparent setup and donors can see it on the campaign page.
          </p>

          {status?.pendingInvite && (
            <div style={{ padding: '10px 14px', background: 'var(--s2, #f5f0ff)', borderRadius: 10, fontSize: 13, color: 'var(--t2)', marginBottom: 14 }}>
              ✉️ Invite pending: <b>{status.pendingInvite.email}</b> — they&apos;ll appear here once they accept and connect their bank.
            </div>
          )}
          {sent && (
            <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, fontSize: 13, color: '#047857', marginBottom: 14 }}>
              ✓ Invitation sent! It expires in 7 days.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="beneficiary@email.com"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--b2)', fontSize: 14, background: 'var(--s1)', color: 'var(--t1)' }}
            />
            <button
              onClick={sendInvite}
              disabled={sending}
              className="kf-primary"
              style={{ whiteSpace: 'nowrap' }}
            >
              {sending ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </section>

        <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.6, margin: 0 }}>
          💡 Why this matters: platforms that pool donations into their own balance create payout delays,
          frozen-funds horror stories, and trust problems. CharitMe uses Stripe destination charges so the
          money is never ours to hold — it belongs to the recipient from the second a donor taps Pay.
        </p>
      </div>
    </CharitMeShell>
  );
}
