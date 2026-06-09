'use client';

import React, { useState } from 'react';
import Link from 'next/link';

// ── Types passed from server component ───────────────────────────────────────
export type RefundableDonation = {
  id: string;
  amount_cents: number;
  campaign_title: string;
  campaign_id: string;
  created_at: string;
  status: string;
  existing_request: boolean; // true if a refund request already exists
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RefundForm({
  donations,
  preselectedId,
}: {
  donations: RefundableDonation[];
  preselectedId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    preselectedId ?? donations.find((d) => !d.existing_request)?.id ?? '',
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const selected = donations.find((d) => d.id === selectedId) ?? null;
  const eligible = selected && !selected.existing_request && selected.status === 'completed';
  const age = selected ? daysAgo(selected.created_at) : 0;
  const overLimit = age > 60;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !eligible) return;

    if (reason.trim().length < 10) {
      setError('Please describe the reason in at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/donations/${selectedId}/refund-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        style={{
          background: 'var(--green-light, #f0fff8)',
          border: '1.5px solid var(--b1, #bbf7d0)',
          borderRadius: 14,
          padding: '32px 28px',
          textAlign: 'center',
          maxWidth: 500,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: 'var(--green-dark, #064e3b)' }}>
          Refund request submitted
        </h2>
        <p style={{ fontSize: 14, color: 'var(--green-dark, #065f46)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Our team will review your request and respond within 3–5 business days.
          You&apos;ll receive an email when there&apos;s an update.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/dashboard/donations"
            style={{
              padding: '10px 22px',
              borderRadius: 9,
              background: '#19b86a',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Back to Donations
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: '10px 22px',
              borderRadius: 9,
              border: '1px solid var(--b2)',
              color: 'var(--t1)',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              background: 'var(--s1)',
            }}
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── No eligible donations ─────────────────────────────────────────────────
  if (donations.length === 0) {
    return (
      <div
        style={{
          background: 'var(--s2)',
          border: '1px solid var(--b2)',
          borderRadius: 14,
          padding: '40px 28px',
          textAlign: 'center',
          maxWidth: 500,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
          No eligible donations
        </h2>
        <p style={{ fontSize: 13, color: 'var(--t3)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Refund requests can only be submitted for completed donations made within the
          last 60 days that haven&apos;t already been refunded or requested.
        </p>
        <Link
          href="/dashboard/donations"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--green)',
            textDecoration: 'none',
          }}
        >
          ← Back to Donations
        </Link>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 22, maxWidth: 560 }}>
      {/* Donation selector */}
      <section className="kf-card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 14px', color: 'var(--t1)' }}>
          Select a donation
        </h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {donations.map((d) => {
            const isSelected = d.id === selectedId;
            const hasPending = d.existing_request;
            const isOver60 = daysAgo(d.created_at) > 60;
            const disabled = hasPending || isOver60;

            return (
              <label
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  border: `1.5px solid ${isSelected && !disabled ? 'var(--green)' : 'var(--b2)'}`,
                  borderRadius: 10,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  background: isSelected && !disabled ? 'var(--green-light, #f0fff8)' : 'var(--s1)',
                  opacity: disabled ? 0.55 : 1,
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <input
                  type="radio"
                  name="donation"
                  value={d.id}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => {
                    setSelectedId(d.id);
                    setError('');
                  }}
                  style={{ accentColor: 'var(--green)', width: 16, height: 16, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong
                      style={{
                        fontSize: 14,
                        color: 'var(--t1)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.campaign_title}
                    </strong>
                    <strong style={{ fontSize: 14, color: 'var(--green)', flexShrink: 0 }}>
                      {fmtCents(d.amount_cents)}
                    </strong>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--t3)',
                      marginTop: 3,
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{fmtDate(d.created_at)}</span>
                    {hasPending && (
                      <span
                        style={{
                          background: 'rgba(245,158,11,.12)',
                          color: '#c2410c',
                          padding: '1px 8px',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        Request pending
                      </span>
                    )}
                    {isOver60 && !hasPending && (
                      <span
                        style={{
                          background: 'rgba(190,18,60,.08)',
                          color: 'var(--red, #b91c1c)',
                          padding: '1px 8px',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        Over 60 days
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Reason */}
      <section className="kf-card" style={{ padding: 20 }}>
        <label
          style={{ display: 'grid', gap: 8, fontSize: 13, fontWeight: 750, color: 'var(--t1)' }}
        >
          Reason for refund request *
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="Please describe why you are requesting a refund. Include any relevant details that will help our team review your request."
            rows={5}
            maxLength={1000}
            required
            style={{
              border: '1.5px solid var(--b2)',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 110,
              lineHeight: 1.6,
              outline: 'none',
              color: 'var(--t1)',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'right' }}>
            {reason.length}/1000
          </span>
        </label>
      </section>

      {/* Eligibility warning */}
      {selected && overLimit && (
        <div
          style={{
            background: 'rgba(190,18,60,.08)',
            border: '1px solid rgba(190,18,60,.25)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 13,
            color: 'var(--red, #991b1b)',
            fontWeight: 600,
          }}
        >
          This donation is more than 60 days old and is not eligible for a refund request.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            background: 'rgba(190,18,60,.08)',
            border: '1px solid rgba(190,18,60,.25)',
            borderRadius: 10,
            padding: '12px 16px',
            fontSize: 13,
            color: 'var(--red, #be123c)',
            fontWeight: 600,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Policy notice */}
      <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0, lineHeight: 1.6 }}>
        Refund requests are reviewed within 3–5 business days. Submitting a request does not
        guarantee a refund. Approved refunds are returned to your original payment method.
        Donations are generally non-refundable unless the campaign is found to be fraudulent or the
        organizer agrees to the refund.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={submitting || !eligible || !reason.trim() || overLimit}
          style={{
            height: 46,
            padding: '0 28px',
            border: 0,
            borderRadius: 10,
            background:
              submitting || !eligible || !reason.trim() || overLimit
                ? 'rgba(108,53,255,.4)'
                : 'linear-gradient(135deg, var(--violet, #6c35ff), #4d1ee0)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor:
              submitting || !eligible || !reason.trim() || overLimit
                ? 'not-allowed'
                : 'pointer',
            transition: 'opacity .15s',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Refund Request'}
        </button>
        <Link
          href="/dashboard/donations"
          style={{
            height: 46,
            padding: '0 24px',
            border: '1px solid var(--b2)',
            borderRadius: 10,
            background: 'var(--s1)',
            color: 'var(--t1)',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
