'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Btn, Input, Textarea } from '../../../components/ui';

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Sponsorship offer sent — awaiting the organizer’s response.', tone: 'var(--t2)' },
  accepted: { label: 'Your sponsorship was accepted! The organizer will coordinate next steps.', tone: 'var(--green-dark)' },
  declined: { label: 'This sponsorship offer was declined.', tone: 'var(--t3)' },
  withdrawn: { label: 'You withdrew this sponsorship offer.', tone: 'var(--t3)' },
  fulfilled: { label: 'Sponsorship fulfilled — thank you for your support!', tone: 'var(--green-dark)' },
};

const linkButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 600,
  fontSize: 14,
  padding: '10px 20px',
  borderRadius: 'var(--r)',
  background: 'var(--green)',
  color: '#fff',
  textDecoration: 'none',
};

export default function SponsorPanel({
  opportunityId,
  currency,
  minAmountCents,
  signedIn,
  isOrganizer,
  accepting,
  existingStatus,
}: {
  opportunityId: string;
  currency: string;
  minAmountCents: number;
  signedIn: boolean;
  isOrganizer: boolean;
  accepting: boolean;
  existingStatus: string | null;
}) {
  const [amount, setAmount] = useState(minAmountCents > 0 ? String(minAmountCents / 100) : '');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(existingStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setSubmitting(true);
    setError(null);
    try {
      const list = await fetch('/api/sponsorships/requests').then((r) => r.json());
      const mine = (list.requests ?? []).find(
        (r: { opportunity_id: string; id: string }) => r.opportunity_id === opportunityId,
      );
      if (!mine) {
        setError('Could not find your request.');
        return;
      }
      const res = await fetch(`/api/sponsorships/requests/${mine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' }),
      });
      if (!res.ok) {
        setError('Could not withdraw. Please try again.');
        return;
      }
      setStatus('withdrawn');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setError('Enter a valid amount.');
      return;
    }
    if (cents < minAmountCents) {
      setError(`Minimum sponsorship is ${(minAmountCents / 100).toFixed(2)} ${currency}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/sponsorships/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          amount_cents: cents,
          company_name: company || null,
          message: message || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not send your offer.');
        return;
      }
      setStatus('pending');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isOrganizer) {
    return (
      <div style={{ fontSize: 14, color: 'var(--t3)' }}>
        This is your opportunity.{' '}
        <Link href="/sponsor/manage" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>
          Manage sponsorship offers →
        </Link>
      </div>
    );
  }

  if (status) {
    const copy = STATUS_COPY[status] ?? { label: `Status: ${status}`, tone: 'var(--t2)' };
    const canWithdraw = status === 'pending' || status === 'accepted';
    return (
      <div>
        <p style={{ fontSize: 15, color: copy.tone, fontWeight: 600 }}>{copy.label}</p>
        {canWithdraw && (
          <Btn variant="ghost" disabled={submitting} onClick={withdraw}>
            Withdraw offer
          </Btn>
        )}
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  if (!signedIn) {
    return (
      <Link href={`/login?next=/sponsor/${opportunityId}`} style={linkButtonStyle}>
        Sign in to sponsor
      </Link>
    );
  }

  if (!accepting) {
    return <p style={{ fontSize: 14, color: 'var(--t3)' }}>This opportunity is no longer accepting sponsors.</p>;
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Offer a sponsorship</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 460 }}>
        <Input
          label={`Amount (${currency})`}
          type="number"
          min={minAmountCents > 0 ? minAmountCents / 100 : 1}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          label="Company / sponsor name (optional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Co."
        />
        <Textarea
          label="Message to the organizer (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        {error && <p style={{ color: 'var(--red-text)', fontSize: 13 }}>{error}</p>}
        <div>
          <Btn disabled={submitting} onClick={submit}>
            {submitting ? 'Sending…' : 'Send sponsorship offer'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
