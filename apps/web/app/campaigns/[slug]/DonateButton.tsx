'use client';

import React, { useMemo, useState } from 'react';
import {
  MAX_DONATION_CENTS,
  DEFAULT_DONOR_TIP_PERCENT,
  donorTip,
} from '@shared/fees';
import { createClient } from '../../../lib/supabase-browser';

/* ── Design tokens (CSS-variable-aware for dark mode) ──── */
const V   = 'var(--violet, #6c35ff)';
const VL  = 'var(--s2, #f5f0ff)';
const VD  = '#4d1ee0';          // only used inside gradient on coloured bg — stays hex
const GR  = 'var(--green, #059669)';
const BD  = 'var(--b2, #e2d9ff)';
const MU  = 'var(--t3, #64748b)';
const INK = 'var(--t1, #1a1a2e)';

/* Preset amounts shown in the 3×2 grid */
const PRESETS = [50, 100, 250, 500, 1000, 2000] as const;

/* Tip range: 0–20% */
const TIP_MIN = 0;
const TIP_MAX = 20;

/**
 * Per-method processing fee.
 * All routes ultimately go through Stripe; these reflect Stripe's published
 * rates for each payment rail as of 2024.
 *  - Card / Stripe / Google Pay / Apple Pay: 2.9% + $0.30
 *  - PayPal (via Stripe): 3.49% + $0.49
 *  - Venmo (via Stripe):  1.9%  + $0.10
 *  - ACH / Bank transfer: 0.8%  capped at $5.00
 */
type PaymentMethod = 'stripe' | 'paypal' | 'venmo' | 'gpay' | 'bank' | 'card';

interface FeeConfig { pct: number; fixed: number; cap?: number; label: string }

const METHOD_FEES: Record<PaymentMethod, FeeConfig> = {
  stripe: { pct: 2.9,  fixed: 30,  label: '2.9% + $0.30' },
  card:   { pct: 2.9,  fixed: 30,  label: '2.9% + $0.30' },
  gpay:   { pct: 2.9,  fixed: 30,  label: '2.9% + $0.30' },
  paypal: { pct: 3.49, fixed: 49,  label: '3.49% + $0.49' },
  venmo:  { pct: 1.9,  fixed: 10,  label: '1.9% + $0.10' },
  bank:   { pct: 0.8,  fixed: 0, cap: 500, label: '0.8% (max $5)' },
};

function methodProcessingFee(amountCents: number, method: PaymentMethod): number {
  const cfg = METHOD_FEES[method];
  const fee = Math.round(amountCents * (cfg.pct / 100)) + cfg.fixed;
  return cfg.cap !== undefined ? Math.min(fee, cfg.cap) : fee;
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const moneyShort = (cents: number) => {
  const d = cents / 100;
  return d % 1 === 0 ? `$${d.toLocaleString('en-US')}` : money(cents);
};

type FrequencyMode = 'once' | 'monthly';

interface PayOption { id: PaymentMethod; label: string; icon: React.ReactNode }

const PAY_OPTIONS: PayOption[] = [
  { id: 'stripe',  label: 'Stripe',         icon: <span style={{ fontWeight: 900, fontSize: 13, color: '#635bff' }}>S</span> },
  { id: 'paypal',  label: 'PayPal',         icon: <span style={{ fontWeight: 900, fontSize: 13, color: '#003087' }}>P</span> },
  { id: 'venmo',   label: 'Venmo',          icon: <span style={{ fontWeight: 900, fontSize: 13, color: '#3D95CE' }}>V</span> },
  { id: 'gpay',    label: 'Google Pay',     icon: <span style={{ fontWeight: 900, fontSize: 13, color: '#4285F4' }}>G</span> },
  { id: 'bank',    label: 'Bank transfer',  icon: <span style={{ fontSize: 14 }}>🏛</span> },
  { id: 'card',    label: 'Credit or debit',icon: <span style={{ fontSize: 14 }}>💳</span> },
];

interface UtmProps {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  shareEventId?: string;
}

export default function DonateButton({
  campaignId,
  campaignTitle,
  utm,
}: {
  campaignId: string;
  campaignTitle: string;
  utm?: UtmProps;
}) {
  const [frequency, setFrequency]         = useState<FrequencyMode>('once');
  const [amount, setAmount]               = useState('100');
  const [subscribeEmail, setSubscribeEmail] = useState(false);
  const [anonymous, setAnonymous]         = useState(false);
  const [tipPercent, setTipPercent]       = useState<number>(DEFAULT_DONOR_TIP_PERCENT);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [guestEmail, setGuestEmail]       = useState('');
  const [isGuest, setIsGuest]             = useState<boolean | null>(null);
  const [preferredMethod, setPreferredMethod] = useState<PaymentMethod>('stripe');

  const amountCents = Math.round((Number.parseFloat(amount) || 0) * 100);
  const isMonthly   = frequency === 'monthly';

  const breakdown = useMemo(() => {
    const tip        = donorTip(amountCents, tipPercent);
    const subTotal   = amountCents + tip;
    const processing = !isMonthly ? methodProcessingFee(subTotal, preferredMethod) : 0;
    const total      = subTotal + processing;
    return { tip, processing, total };
  }, [amountCents, tipPercent, isMonthly, preferredMethod]);

  const handleDonate = async () => {
    if (Number.isNaN(amountCents) || amountCents < 100) { setError('Minimum donation is $1.00'); return; }
    if (amountCents > MAX_DONATION_CENTS)               { setError('Maximum donation is $1,000,000'); return; }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && isGuest === null) { setIsGuest(true); return; }
    if (!user && !guestEmail.trim()) { setError('Please enter your email to receive a receipt.'); return; }

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
          message: undefined,
          anonymous,
          coverProcessingFee: !isMonthly,
          tipPercent,
          paymentMethod: preferredMethod,
          donorEmail: !user && guestEmail.trim() ? guestEmail.trim() : undefined,
          // Share attribution — forwarded from landing URL
          ...(utm?.utmSource    ? { utmSource:    utm.utmSource }    : {}),
          ...(utm?.utmMedium    ? { utmMedium:    utm.utmMedium }    : {}),
          ...(utm?.utmCampaign  ? { utmCampaign:  utm.utmCampaign }  : {}),
          ...(utm?.utmContent   ? { utmContent:   utm.utmContent }   : {}),
          ...(utm?.shareEventId ? { shareEventId: utm.shareEventId } : {}),
        }),
      });
      const text = await res.text();
      const data = (text ? JSON.parse(text) : {}) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);
      if (!data.url) throw new Error('No checkout URL returned. Please try again.');
      window.location.href = data.url!;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Frequency toggle ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: 'var(--s3, #f0eaff)', borderRadius: 14, padding: 4 }}>
        {(['once', 'monthly'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFrequency(f); setError(''); }}
            style={{
              padding: '11px 4px',
              border: 0,
              borderRadius: 10,
              background: frequency === f ? (f === 'monthly' ? GR : 'var(--s1, #fff)') : 'transparent',
              color: frequency === f ? (f === 'monthly' ? '#fff' : V) : MU,
              fontWeight: 900,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: frequency === f ? '0 2px 10px rgba(0,0,0,.12)' : 'none',
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {f === 'once' ? 'Give Once' : <>Give Monthly <span style={{ fontSize: 16 }}>🌱</span></>}
          </button>
        ))}
      </div>

      {/* ── Monthly boost nudge ── */}
      {isMonthly && (
        <div style={{ background: 'var(--green-light, #e8f8ee)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--b1, #e8e4fb)' }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: GR }}>
            💚 0% platform fee · 100% reaches the campaign
          </div>
          <div style={{ fontSize: 12, color: GR, marginTop: 3, opacity: .85 }}>
            Cancel any time.
          </div>
        </div>
      )}
      {!isMonthly && (
        <div style={{ background: 'var(--green-light, #f0fff8)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--b1, #e8e4fb)' }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: 'var(--green-dark, #065f46)' }}>0% mandatory platform fee</div>
          <div style={{ fontSize: 12, color: 'var(--green-dark, #065f46)', marginTop: 3 }}>
            CharitMe is supported by optional donor tips. Every fee is shown before checkout.
          </div>
        </div>
      )}

      {/* ── Preset amounts — 3×2 grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {PRESETS.map((preset) => {
          const active = amount === String(preset);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              style={{
                padding: '11px 4px',
                border: `2px solid ${active ? V : BD}`,
                borderRadius: 12,
                background: active ? V : 'var(--s1, #fff)',
                color: active ? '#fff' : INK,
                fontWeight: 900,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'border-color .15s, background .15s, color .15s',
              }}
            >
              ${preset.toLocaleString()}
            </button>
          );
        })}
      </div>

      {/* ── Custom amount input ── */}
      <div style={{ border: `1.5px solid ${BD}`, borderRadius: 12, background: 'var(--s1, #fff)', overflow: 'hidden', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: MU }}>$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            aria-label="Donation amount in dollars"
            style={{
              flex: 1,
              border: 0,
              fontSize: 28,
              fontWeight: 900,
              outline: 'none',
              background: 'transparent',
              color: INK,
              fontFamily: 'inherit',
              padding: 0,
            }}
          />
          {isMonthly && <span style={{ fontSize: 13, color: MU, fontWeight: 700 }}>/mo</span>}
        </div>
        <div style={{ fontSize: 11, color: MU, fontWeight: 700, marginTop: 4, letterSpacing: '.05em' }}>USD</div>
      </div>

      {/* ── Tip CharitMe services — slider ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>Tip CharitMe services</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: V }}>{tipPercent}%</span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: MU, lineHeight: 1.5 }}>
          CharitMe has a 0% platform fee for organizers and relies primarily on the generosity of donors like you to operate our service.
        </p>
        <input
          type="range"
          min={TIP_MIN}
          max={TIP_MAX}
          step="0.5"
          value={tipPercent}
          onChange={(e) => setTipPercent(Number(e.target.value))}
          aria-label="Tip percentage"
          style={{ width: '100%', accentColor: V, cursor: 'pointer' }}
        />
        <button
          type="button"
          onClick={() => setTipPercent(0)}
          style={{ background: 'none', border: 'none', color: V, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '6px 0 0', display: 'block' }}
        >
          Enter custom tip
        </button>
      </div>

      {/* ── Payment method — radio list ── */}
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 900, color: MU, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Payment method
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1.5px solid ${BD}`, borderRadius: 14, overflow: 'hidden' }}>
          {PAY_OPTIONS.map((opt, idx) => {
            const active = preferredMethod === opt.id;
            const feeCfg = METHOD_FEES[opt.id];
            return (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 16px',
                  background: active ? VL : 'var(--s1, #fff)',
                  borderTop: idx > 0 ? `1px solid ${BD}` : 'none',
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
              >
                <input
                  type="radio"
                  name="preferredMethod"
                  value={opt.id}
                  checked={active}
                  onChange={() => setPreferredMethod(opt.id)}
                  style={{ accentColor: V, width: 16, height: 16, flexShrink: 0 }}
                />
                <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--s2, #f5f5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {opt.icon}
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 800 : 600, color: active ? V : INK }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 11, color: MU, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {feeCfg.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Checkboxes ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--t2, #4c5679)', fontWeight: 600, lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: V, marginTop: 2, flexShrink: 0 }}
          />
          Don&apos;t display my name or profile publicly on the fundraiser
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: `1px solid ${BD}`, fontSize: 10, color: MU, flexShrink: 0, cursor: 'help' }} title="Your name will not appear on the donor list">ⓘ</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--t2, #4c5679)', fontWeight: 600, lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={subscribeEmail}
            onChange={(e) => setSubscribeEmail(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: V, marginTop: 2, flexShrink: 0 }}
          />
          Subscribe to receive emails
        </label>
      </div>

      {/* ── Guest email ── */}
      {isGuest && (
        <div style={{ background: 'var(--s2, #fffbeb)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--b1, #fde68a)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--t2, #92400e)' }}>
            Enter your email to receive a receipt:
          </p>
          <input
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="your@email.com"
            aria-label="Email for receipt"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--b2, #fcd34d)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: 'var(--s1, #fff)', color: INK }}
          />
        </div>
      )}

      {/* ── Transparent breakdown ── */}
      <div style={{ background: 'var(--s2, #f9f7ff)', borderRadius: 14, padding: '16px 18px', border: `1px solid ${BD}` }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 900, color: MU, textTransform: 'uppercase', letterSpacing: '.07em' }}>
          Transparent breakdown
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <BRow label={isMonthly ? 'Monthly donation' : 'Donation'} value={money(amountCents)} />
          {breakdown.tip > 0 && <BRow label={`CharitMe tip (${tipPercent}%)`} value={money(breakdown.tip)} />}
          {breakdown.processing > 0 && (
            <BRow
              label={`Processing fee (${METHOD_FEES[preferredMethod].label})`}
              value={money(breakdown.processing)}
            />
          )}
          <div style={{ borderTop: `1px solid ${BD}`, marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 950, color: INK }}>
            <span>Total{isMonthly ? '/month' : ''}</span>
            <span>{money(breakdown.total)}</span>
          </div>
        </div>
      </div>

      {error && (
        <p style={{ margin: 0, padding: '10px 14px', borderRadius: 10, background: '#fff0f3', color: '#ef4444', fontSize: 13, fontWeight: 700, border: '1px solid #fecdd3' }}>
          ⚠ {error}
        </p>
      )}

      {/* ── CTA ── */}
      <button
        type="button"
        aria-label={`Donate to ${campaignTitle}`}
        disabled={loading}
        onClick={handleDonate}
        style={{
          width: '100%',
          padding: '17px',
          borderRadius: 14,
          border: 0,
          background: loading
            ? '#9f77e8'
            : isMonthly
            ? `linear-gradient(135deg, ${GR}, #047857)`
            : `linear-gradient(135deg, ${V}, ${VD})`,
          color: '#fff',
          fontSize: 17,
          fontWeight: 950,
          cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: '-.01em',
          boxShadow: isMonthly
            ? '0 6px 22px rgba(5,150,105,.35)'
            : '0 6px 22px rgba(108,53,255,.38)',
          transition: 'opacity .15s',
          fontFamily: 'inherit',
        }}
      >
        {loading
          ? 'Opening secure checkout…'
          : isMonthly
          ? `Give ${money(breakdown.total)}/month →`
          : amountCents >= 100
          ? `Give ${moneyShort(breakdown.total)} →`
          : 'Give →'}
      </button>

      <div style={{ textAlign: 'center', fontSize: 11, color: MU, fontWeight: 700 }}>
        🔒 SSL encrypted · Powered by Stripe
      </div>

    </div>
  );
}

function BRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: MU }}>
      <span>{label}</span>
      <span style={{ fontWeight: 800, color: INK }}>{value}</span>
    </div>
  );
}
