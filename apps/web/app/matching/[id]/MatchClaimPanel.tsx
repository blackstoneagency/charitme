'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatMoneyShort } from '@shared/currencies';
import { Btn, Input, Badge } from '../../../components/ui';
import { computeMatchAmount } from '../../../lib/matching-core';

type Claim = { id: string; status: string; donation_amount_cents: number; match_amount_cents: number };

const STATUS_COLOR: Record<string, 'gray' | 'green' | 'red' | 'blue'> = {
  pending: 'blue',
  approved: 'green',
  declined: 'red',
  paid: 'green',
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

export default function MatchClaimPanel({
  programId,
  currency,
  matchRatio,
  minDonationCents,
  remainingCapCents,
  signedIn,
  isSponsor,
  accepting,
  initialClaims,
}: {
  programId: string;
  currency: string;
  matchRatio: number;
  minDonationCents: number;
  remainingCapCents: number | null;
  signedIn: boolean;
  isSponsor: boolean;
  accepting: boolean;
  initialClaims: Claim[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = amount ? Math.round(Number(amount) * 100) : 0;
  const estimatedMatch = computeMatchAmount({
    donationCents: cents,
    matchRatio,
    minDonationCents,
    remainingCapCents: remainingCapCents ?? Number.POSITIVE_INFINITY,
  });

  async function submit() {
    if (cents < Math.max(1, minDonationCents)) {
      setError(`Enter a donation of at least ${formatMoneyShort(Math.max(1, minDonationCents), currency)}.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/matching/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId, donation_amount_cents: cents }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Could not submit your claim.');
        return;
      }
      setAmount('');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isSponsor) {
    return (
      <div style={{ fontSize: 14, color: 'var(--t3)' }}>
        This is your program.{' '}
        <Link href="/matching/manage" style={{ color: 'var(--green-dark)', fontWeight: 600 }}>
          Review match claims →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {initialClaims.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Your claims</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {initialClaims.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '8px 12px', border: '1px solid var(--b2)', borderRadius: 'var(--r)' }}>
                <span>
                  Donated {formatMoneyShort(c.donation_amount_cents, currency)} · match {formatMoneyShort(c.match_amount_cents, currency)}
                </span>
                <Badge color={STATUS_COLOR[c.status] ?? 'gray'}>{c.status}</Badge>
              </div>
            ))}
          </div>
          {remainingCapCents !== null && (
            <p style={{ fontSize: 13, color: 'var(--t4)', marginTop: 8 }}>
              Remaining annual match cap: {formatMoneyShort(remainingCapCents, currency)}
            </p>
          )}
        </div>
      )}

      {!signedIn ? (
        <Link href={`/login?next=/matching/${programId}`} style={linkButtonStyle}>
          Sign in to claim a match
        </Link>
      ) : !accepting ? (
        <p style={{ fontSize: 14, color: 'var(--t3)' }}>This program is not currently accepting claims.</p>
      ) : (
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Claim a match</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
            <Input
              label={`Your donation amount (${currency})`}
              type="number"
              min={Math.max(0.01, minDonationCents / 100)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {cents > 0 && (
              <p style={{ fontSize: 14, color: estimatedMatch > 0 ? 'var(--green-dark)' : 'var(--t3)' }}>
                Estimated match: <strong>{formatMoneyShort(estimatedMatch, currency)}</strong>
                {estimatedMatch === 0 && ' (below minimum or cap reached)'}
              </p>
            )}
            {error && <p style={{ color: 'var(--red-text)', fontSize: 13 }}>{error}</p>}
            <div>
              <Btn disabled={submitting} onClick={submit}>
                {submitting ? 'Submitting…' : 'Submit match claim'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
