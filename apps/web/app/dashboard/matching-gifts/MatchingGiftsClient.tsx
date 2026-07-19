'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { currencySymbol } from '@shared/currencies';
import { Btn, Input, Select, Badge, Card, EmptyState } from '../../../components/ui';
import {
  estimateMatchForEmployer,
  matchingGiftStatusLabel,
  type MatchingGiftStatus,
} from '../../../lib/matching-gifts';

export type EligibleDonation = {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  campaignTitle: string;
};

export type ClaimView = {
  id: string;
  donationId: string;
  employerName: string;
  donationAmountCents: number;
  matchRatio: number;
  estimatedMatchCents: number;
  status: string;
  employerReference: string | null;
  note: string | null;
  createdAt: string;
  campaignTitle: string;
  campaignSlug: string | null;
};

function fmt(cents: number, currency = 'usd'): string {
  return `${currencySymbol(currency)}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function badgeColor(status: string): 'green' | 'red' | 'blue' | 'gray' {
  if (status === 'received') return 'green';
  if (status === 'declined' || status === 'cancelled') return 'red';
  if (status === 'approved') return 'blue';
  return 'gray';
}

export default function MatchingGiftsClient({
  initialClaims,
  eligibleDonations,
}: {
  initialClaims: ClaimView[];
  eligibleDonations: EligibleDonation[];
}) {
  const [claims, setClaims] = useState<ClaimView[]>(initialClaims);
  const [available, setAvailable] = useState<EligibleDonation[]>(eligibleDonations);
  const [donationId, setDonationId] = useState<string>(eligibleDonations[0]?.id ?? '');
  const [employer, setEmployer] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDonation = available.find((d) => d.id === donationId) ?? null;

  // Live estimate using the same pure logic the server uses.
  const estimate = useMemo(() => {
    if (!selectedDonation || employer.trim().length < 2) return null;
    return estimateMatchForEmployer(selectedDonation.amountCents, employer);
  }, [selectedDonation, employer]);

  const totalMatched = claims
    .filter((c) => c.status === 'received')
    .reduce((s, c) => s + c.estimatedMatchCents, 0);
  const pendingEstimate = claims
    .filter((c) => !['received', 'declined', 'cancelled'].includes(c.status))
    .reduce((s, c) => s + c.estimatedMatchCents, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDonation || employer.trim().length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/matching-gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId, employerName: employer.trim(), note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not file matching gift');
        return;
      }
      const c = data.claim;
      setClaims((prev) => [
        {
          id: c.id,
          donationId: c.donation_id,
          employerName: c.employer_name,
          donationAmountCents: c.donation_amount_cents,
          matchRatio: c.match_ratio,
          estimatedMatchCents: c.estimated_match_cents,
          status: c.status,
          employerReference: c.employer_reference,
          note: c.note,
          createdAt: c.created_at,
          campaignTitle: selectedDonation.campaignTitle,
          campaignSlug: null,
        },
        ...prev,
      ]);
      setAvailable((prev) => prev.filter((d) => d.id !== donationId));
      setEmployer('');
      setNote('');
      setDonationId('');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelClaim(id: string) {
    const res = await fetch(`/api/matching-gifts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (res.ok) {
      setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'cancelled' } : c)));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Impact summary */}
      {claims.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          <Card><div style={{ fontSize: 13, color: 'var(--t3)' }}>Matches received</div><strong style={{ fontSize: 22 }}>{fmt(totalMatched)}</strong></Card>
          <Card><div style={{ fontSize: 13, color: 'var(--t3)' }}>Pending (estimated)</div><strong style={{ fontSize: 22 }}>{fmt(pendingEstimate)}</strong></Card>
          <Card><div style={{ fontSize: 13, color: 'var(--t3)' }}>Claims filed</div><strong style={{ fontSize: 22 }}>{claims.length}</strong></Card>
        </div>
      )}

      {/* File a new claim */}
      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>File a matching gift</h2>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>
          Pick a donation and enter your employer. We&apos;ll estimate the match and track it here. Confirm the exact
          amount and process through your employer&apos;s giving/HR portal.
        </p>

        {available.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            Every completed donation already has a matching-gift claim. <Link href="/campaigns">Donate again</Link> to file another.
          </p>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Donation
              <Select value={donationId} onChange={(e) => setDonationId(e.target.value)}>
                <option value="" disabled>Select a donation…</option>
                {available.map((d) => (
                  <option key={d.id} value={d.id}>
                    {fmt(d.amountCents, d.currency)} · {d.campaignTitle} · {fmtDate(d.createdAt)}
                  </option>
                ))}
              </Select>
            </label>

            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Employer
              <Input
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                placeholder="e.g. Microsoft"
                aria-label="Your employer's name"
              />
            </label>

            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Note (optional)
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember about this match" />
            </label>

            {estimate && (
              <div
                role="status"
                style={{ padding: '10px 14px', background: 'var(--green-light, #f0fff8)', border: '1px solid #bbf7d0', borderRadius: 10, fontSize: 13, color: '#065f46' }}
              >
                {estimate.matched && estimate.ratio > 0 ? (
                  <>💚 <strong>{estimate.employer?.name}</strong> typically matches {estimate.employer?.typicalRatio}. Estimated match on this
                  gift: <strong>{fmt(estimate.estimatedMatchCents, selectedDonation?.currency)}</strong>.</>
                ) : (
                  <>We don&apos;t have a known program for &ldquo;{employer.trim()}&rdquo;. You can still file the claim — confirm the ratio with your employer&apos;s giving portal.</>
                )}
              </div>
            )}

            {error && (
              <div role="alert" style={{ fontSize: 13, color: 'var(--red, #dc2626)' }}>{error}</div>
            )}

            <div>
              <Btn type="submit" disabled={submitting || !donationId || employer.trim().length < 2}>
                {submitting ? 'Filing…' : 'File matching gift'}
              </Btn>
            </div>
          </form>
        )}
      </Card>

      {/* Existing claims */}
      <Card>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Your matching gifts</h2>
        {claims.length === 0 ? (
          <EmptyState
            icon="💼"
            title="No matching gifts yet"
            body="After you donate, file a matching gift here to potentially double your impact at no extra cost."
            action={<Link href="/campaigns" className="kf-primary" style={{ textDecoration: 'none' }}>Browse campaigns</Link>}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {claims.map((c) => {
              const canCancel = !['received', 'declined', 'cancelled'].includes(c.status);
              return (
                <div
                  key={c.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', border: '1px solid var(--b2, #e5e7eb)', borderRadius: 10, flexWrap: 'wrap' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{c.employerName}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                      {c.campaignSlug ? (
                        <Link href={`/campaigns/${c.campaignSlug}`} style={{ color: 'var(--t3)' }}>{c.campaignTitle}</Link>
                      ) : c.campaignTitle}
                      {' · '}Gift {fmt(c.donationAmountCents)} · Est. match <strong>{fmt(c.estimatedMatchCents)}</strong>
                      {c.matchRatio > 0 ? ` (${c.matchRatio}:1)` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Badge color={badgeColor(c.status)}>{matchingGiftStatusLabel(c.status as MatchingGiftStatus)}</Badge>
                    {canCancel && (
                      <Btn variant="ghost" onClick={() => cancelClaim(c.id)}>Cancel</Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
