'use client';

import React, { useMemo, useState } from 'react';
import {
  MAX_DONATION_CENTS,
  TIP_OPTIONS,
  DEFAULT_DONOR_TIP_PERCENT,
  donationTotal,
  donorTip,
  processingFee,
} from '@shared/fees';
import { createClient } from '../../../lib/supabase-browser';

const VIOLET = '#7b35ff';
const VIOLET_LIGHT = '#f5f0ff';
const VIOLET_DARK = '#4d1ee0';
const BORDER = '#e2d9ff';
const MUTED = '#64748b';
const INK = '#1a1a2e';
const GREEN = '#059669';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

type FrequencyMode = 'once' | 'monthly';

export default function DonateButton({
  campaignId,
  campaignTitle,
}: {
  campaignId: string;
  campaignTitle: string;
}) {
  const [frequency, setFrequency] = useState<FrequencyMode>('once');
  const [amount, setAmount] = useState('50');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [coverProcessingFee, setCoverProcessingFee] = useState(true);
  const [tipPercent, setTipPercent] = useState<number>(DEFAULT_DONOR_TIP_PERCENT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  const amountCents = Math.round((Number.parseFloat(amount) || 0) * 100);
  const isMonthly = frequency === 'monthly';

  const breakdown = useMemo(
    () => ({
      tip: donorTip(amountCents, tipPercent),
      processing: coverProcessingFee && !isMonthly
        ? processingFee(amountCents + donorTip(amountCents, tipPercent))
        : 0,
      total: isMonthly
        ? amountCents + donorTip(amountCents, tipPercent)
        : donationTotal(amountCents, coverProcessingFee, tipPercent),
    }),
    [amountCents, coverProcessingFee, tipPercent, isMonthly],
  );

  const handleDonate = async () => {
    if (Number.isNaN(amountCents) || amountCents < 100) {
      setError('Minimum donation is $1.00');
      return;
    }
    if (amountCents > MAX_DONATION_CENTS) {
      setError('Maximum donation is $1,000,000');
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && isGuest === null) {
      setIsGuest(true);
      return;
    }

    if (!user && !guestEmail.trim()) {
      setError('Please enter your email to receive a receipt.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const endpoint = isMonthly ? '/api/donations/recurring' : '/api/donations';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(!isMonthly ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
        },
        body: JSON.stringify({
          campaignId,
          amountCents,
          cadence: 'monthly',
          message: message || undefined,
          anonymous,
          coverProcessingFee: isMonthly ? false : coverProcessingFee,
          tipPercent,
          donorEmail: !user && guestEmail.trim() ? guestEmail.trim() : undefined,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to start checkout');
      if (!data.url) throw new Error('No checkout URL returned from server');
      window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Frequency toggle ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
        background: '#f0eaff', borderRadius: 14, padding: 4,
      }}>
        {(['once', 'monthly'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFrequency(f); setError(''); }}
            style={{
              padding: '10px 4px',
              border: 0,
              borderRadius: 10,
              background: frequency === f ? '#fff' : 'transparent',
              color: frequency === f ? VIOLET : MUTED,
              fontWeight: frequency === f ? 900 : 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: frequency === f ? '0 2px 8px rgba(123,53,255,.12)' : 'none',
              transition: 'all .15s',
            }}
          >
            {f === 'once' ? 'Give Once' : 'Give Monthly'}
          </button>
        ))}
      </div>

      {/* ── Monthly 0% fee badge ── */}
      {isMonthly && (
        <div style={{
          background: `${GREEN}12`, borderRadius: 10, padding: '10px 14px',
          border: `1px solid ${GREEN}30`,
        }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: GREEN }}>
            💚 0% KindFund fee on recurring donations
          </div>
          <div style={{ fontSize: 12, color: GREEN, marginTop: 3, lineHeight: 1.45, opacity: 0.85 }}>
            GoFundMe charges 5% on monthly donations. We charge $0. Cancel any time.
          </div>
        </div>
      )}

      {/* ── 0% fee notice (one-time) ── */}
      {!isMonthly && (
        <div style={{
          background: '#f0fff8', borderRadius: 12, padding: '10px 14px',
          border: '1px solid #bbf7d0',
        }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: '#065f46' }}>0% mandatory platform fee</div>
          <div style={{ fontSize: 12, color: '#065f46', marginTop: 3, lineHeight: 1.45 }}>
            KindFund is supported by optional donor tips. Every fee is shown before checkout.
          </div>
        </div>
      )}

      {/* ── Preset amounts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {([25, 50, 100, 250] as const).map((preset) => {
          const active = amount === String(preset);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              style={{
                padding: '10px 4px',
                border: `2px solid ${active ? VIOLET : BORDER}`,
                borderRadius: 12,
                background: active ? VIOLET_LIGHT : '#fff',
                color: active ? VIOLET : INK,
                fontWeight: 900, fontSize: 15,
                cursor: 'pointer',
                transition: 'border-color .15s, background .15s',
              }}
            >
              ${preset}
            </button>
          );
        })}
      </div>

      {/* ── Custom amount ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1.5px solid ${BORDER}`, borderRadius: 12,
        background: '#fff', overflow: 'hidden',
      }}>
        <span style={{ padding: '0 12px', fontSize: 20, fontWeight: 950, color: MUTED }}>$</span>
        <input
          type="number" min="1" step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Donation amount in dollars"
          style={{
            flex: 1, border: 0, padding: '13px 12px 13px 0',
            fontSize: 18, fontWeight: 800, outline: 'none',
            background: 'transparent', color: INK, fontFamily: 'inherit',
          }}
        />
        {isMonthly && (
          <span style={{ padding: '0 12px', fontSize: 13, color: MUTED, fontWeight: 700 }}>/mo</span>
        )}
      </div>

      {/* ── Optional tip ── */}
      <div>
        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 900,
          color: MUTED, textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          Optional KindFund tip
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {TIP_OPTIONS.map((opt) => {
            const active = tipPercent === opt;
            return (
              <button
                key={opt} type="button"
                onClick={() => setTipPercent(opt)}
                style={{
                  flex: 1, padding: '7px 4px',
                  border: `1.5px solid ${active ? VIOLET : BORDER}`,
                  borderRadius: 9,
                  background: active ? VIOLET_LIGHT : '#fff',
                  color: active ? VIOLET : MUTED,
                  fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  transition: 'border-color .15s, background .15s',
                }}
              >
                {opt === 0 ? '$0' : `${opt}%`}
              </button>
            );
          })}
        </div>
        {tipPercent === 0 && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: MUTED }}>
            No tip is okay — 100% of your donation reaches the campaign.
          </p>
        )}
      </div>

      {/* ── Cover processing fee (one-time only) ── */}
      {!isMonthly && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          fontSize: 13, color: '#4c5679', fontWeight: 700,
          padding: '10px 12px', border: `1px solid ${BORDER}`,
          borderRadius: 10, background: '#fafbff',
        }}>
          <input
            type="checkbox"
            checked={coverProcessingFee}
            onChange={(e) => setCoverProcessingFee(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: VIOLET, flexShrink: 0 }}
          />
          Cover card processing fee (2.9% + $0.30)
        </label>
      )}

      {/* ── Message ── */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Leave a message of support (optional)"
        rows={2} maxLength={500}
        style={{
          width: '100%', boxSizing: 'border-box',
          border: `1.5px solid ${BORDER}`, borderRadius: 12,
          padding: '10px 12px', fontSize: 13, fontFamily: 'inherit',
          resize: 'vertical', outline: 'none', color: INK, background: '#fff',
        }}
      />

      {/* ── Anonymous ── */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        fontSize: 13, color: '#4c5679', fontWeight: 700,
      }}>
        <input
          type="checkbox" checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: VIOLET }}
        />
        Donate anonymously
      </label>

      {/* ── Guest email ── */}
      {isGuest && (
        <div style={{
          background: '#fffbeb', borderRadius: 12, padding: '14px 16px',
          border: '1px solid #fde68a',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
            Enter your email to receive a receipt:
          </p>
          <input
            type="email" value={guestEmail}
            onChange={e => setGuestEmail(e.target.value)}
            placeholder="your@email.com"
            aria-label="Email for receipt"
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid #fcd34d', borderRadius: 9,
              padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff',
            }}
          />
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#a16207' }}>
            Or{' '}
            <a href={`/login?next=${typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname) : ''}`}
              style={{ color: VIOLET, fontWeight: 700 }}>
              sign in
            </a>{' '}to skip this step.
          </p>
        </div>
      )}

      {/* ── Transparent breakdown ── */}
      <div style={{
        background: '#f9f7ff', borderRadius: 12, padding: '14px 16px',
        border: `1px solid ${BORDER}`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 900, color: MUTED,
          textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10,
        }}>
          {isMonthly ? 'Monthly breakdown' : 'Transparent breakdown'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Row label={isMonthly ? 'Monthly donation' : 'Donation'} value={money(amountCents)} />
          {breakdown.tip > 0 && <Row label={`KindFund tip (${tipPercent}%)`} value={money(breakdown.tip)} />}
          {breakdown.processing > 0 && <Row label="Processing fee" value={money(breakdown.processing)} />}
          <div style={{
            borderTop: `1px solid ${BORDER}`, marginTop: 6, paddingTop: 8,
            display: 'flex', justifyContent: 'space-between',
            fontSize: 16, fontWeight: 950, color: INK,
          }}>
            <span>Total{isMonthly ? '/month' : ''}</span>
            <span>{money(breakdown.total)}</span>
          </div>
        </div>
        {isMonthly && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
            Billed monthly. Cancel any time from your donor dashboard.
          </p>
        )}
      </div>

      {error && (
        <p style={{
          margin: 0, padding: '10px 14px', borderRadius: 10,
          background: '#fff0f3', color: '#ef4444', fontSize: 13, fontWeight: 700,
          border: '1px solid #fecdd3',
        }}>
          ⚠ {error}
        </p>
      )}

      {/* ── CTA button ── */}
      <button
        type="button"
        aria-label={`Donate to ${campaignTitle}`}
        disabled={loading}
        onClick={handleDonate}
        style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 0,
          background: loading
            ? '#9f77e8'
            : isMonthly
            ? `linear-gradient(135deg, ${GREEN}, #047857)`
            : `linear-gradient(135deg, ${VIOLET}, ${VIOLET_DARK})`,
          color: '#fff', fontSize: 16, fontWeight: 950,
          cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: '-.01em',
          boxShadow: isMonthly
            ? '0 4px 18px rgba(5,150,105,.35)'
            : '0 4px 18px rgba(123,53,255,.35)',
          transition: 'opacity .15s',
          fontFamily: 'inherit',
        }}
      >
        {loading
          ? 'Opening secure checkout…'
          : isMonthly
          ? `Give ${money(breakdown.total)}/month →`
          : `Donate ${money(breakdown.total)} →`}
      </button>

      <div style={{ textAlign: 'center', fontSize: 11, color: MUTED, fontWeight: 700 }}>
        🔒 SSL encrypted · Powered by Stripe
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED }}>
      <span>{label}</span>
      <span style={{ fontWeight: 800, color: INK }}>{value}</span>
    </div>
  );
}
