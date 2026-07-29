'use client';

import React, { useMemo, useState } from 'react';
import {
  donationBreakdown,
  SUPPORT_TIER_PERCENTS,
  METHOD_FEES,
  type PaymentMethod,
} from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// "Where your money goes" — interactive, responsive calculator. Pure: every
// number comes from the same donationBreakdown() the checkout uses, so what a
// donor sees here is exactly what they'll be charged. Dark/light aware via CSS
// variables. No network, no state beyond the inputs.
// ─────────────────────────────────────────────────────────────────────────────

const V = 'var(--violet, #6c35ff)';
// Violet TEXT that stays AA on both light and dark surfaces (V is too light on --s2 in dark).
const VINK = 'var(--violet-ink, #5b21b6)';
const GR = 'var(--green, #059669)';
// Green TEXT variant — the brand fill fails AA as small text on light surfaces.
const GRT = 'var(--green-text, #0d783c)';
const BD = 'var(--b2, #e2d9ff)';
const MU = 'var(--t3, #64748b)';
const INK = 'var(--t1, #1a1a2e)';
const SURF = 'var(--s1, #fff)';
const SURF2 = 'var(--s2, #f5f0ff)';

// Only methods a donor can actually choose at checkout. PayPal and Venmo were
// offered here with their own (cheaper) rates — 3.49%+$0.49 and 1.9%+$0.10 —
// while `paypal_payments` is NOT active on the Stripe account, so
// POST /api/donations normalizes both to `card`. A donor could size their
// "cover the processing fee" contribution off a Venmo rate they would never be
// charged at. Re-add these once the capability is active in the Stripe
// Dashboard and listed in ONE_TIME_PAYMENT_METHOD_TYPES.
const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'bank', label: 'Bank (ACH)' },
];

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MoneyCalculator() {
  const [amount, setAmount] = useState('100');
  const [supportPercent, setSupportPercent] = useState(15);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [coverProcessing, setCoverProcessing] = useState(true);

  const amountCents = Math.max(0, Math.round((Number.parseFloat(amount) || 0) * 100));

  const b = useMemo(
    () => donationBreakdown({ amountCents, supportPercent, method, coverProcessing }),
    [amountCents, supportPercent, method, coverProcessing],
  );

  // Stacked-bar segments over the total the donor pays.
  const total = Math.max(1, b.totalChargedCents);
  const recipientPct = (b.netToRecipientCents / total) * 100;
  const supportPct = (b.supportCents / total) * 100;
  const processingPct = 100 - recipientPct - supportPct;

  return (
    <div
      style={{
        background: SURF,
        border: `1px solid ${BD}`,
        borderRadius: 18,
        padding: 'clamp(18px, 4vw, 28px)',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      {/* Amount */}
      <label htmlFor="mc-amount" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: MU, marginBottom: 8 }}>
        Your donation
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: `1.5px solid ${BD}`,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 18,
          background: SURF2,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 800, color: MU }}>$</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          id="mc-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            flex: 1,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontSize: 26,
            fontWeight: 800,
            color: INK,
            fontFamily: 'inherit',
            width: '100%',
            padding: 0,
          }}
        />
      </div>

      {/* Support tiers */}
      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: MU, marginBottom: 8 }} id="mc-support-label">
        CharitMe support (optional — always reducible to 0%)
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }} role="group" aria-labelledby="mc-support-label">
        {SUPPORT_TIER_PERCENTS.map((p) => {
          const active = supportPercent === p;
          return (
            <button
              key={p}
              type="button"
              className="mc-choice"
              onClick={() => setSupportPercent(p)}
              aria-pressed={active}
              style={{
                flex: '1 0 auto',
                minWidth: 46,
                padding: '9px 0',
                borderRadius: 10,
                border: `1.5px solid ${active ? V : BD}`,
                background: active ? SURF2 : SURF,
                color: active ? VINK : INK,
                fontSize: 14,
                fontWeight: active ? 800 : 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all .12s',
              }}
            >
              {p === 0 ? 'None' : `${p}%`}
            </button>
          );
        })}
      </div>

      {/* Method + cover toggle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {METHODS.map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className="mc-choice"
                onClick={() => setMethod(m.id)}
                aria-pressed={active}
                style={{
                  padding: '7px 12px',
                  borderRadius: 9,
                  border: `1.5px solid ${active ? V : BD}`,
                  background: active ? SURF2 : SURF,
                  color: active ? VINK : INK,
                  fontSize: 13,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        {/* minHeight 24 is WCAG 2.2 SC 2.5.8 (AA), not spacing taste. Clicking a
            label activates its control, so the LABEL is the thumb target — the
            16x16 checkbox inside it is not what a user has to hit. It measured
            227x20: wide enough, 4px short. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, fontSize: 13, fontWeight: 600, color: INK, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={coverProcessing}
            onChange={(e) => setCoverProcessing(e.target.checked)}
            style={{ accentColor: V, width: 16, height: 16 }}
          />
          I&apos;ll cover the processing fee
        </label>
      </div>

      {/* Animated stacked bar */}
      <div
        style={{
          display: 'flex',
          height: 22,
          borderRadius: 999,
          overflow: 'hidden',
          border: `1px solid ${BD}`,
          marginBottom: 14,
          background: SURF2,
        }}
        aria-hidden
      >
        <div style={{ width: `${recipientPct}%`, background: GR, transition: 'width .35s ease' }} />
        <div style={{ width: `${supportPct}%`, background: V, transition: 'width .35s ease' }} />
        <div style={{ width: `${processingPct}%`, background: 'var(--t4, #94a3b8)', transition: 'width .35s ease' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 22, fontSize: 12, color: MU }}>
        <Legend color={GR} label="Recipient" />
        <Legend color={V} label="CharitMe support" />
        <Legend color="var(--t4, #94a3b8)" label="Processing (Stripe)" />
      </div>

      {/* Line items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Row label="Your donation" value={money(amountCents)} />
        <Row label={`CharitMe support (${supportPercent}%)`} value={supportPercent === 0 ? '$0.00' : money(b.supportCents)} muted={supportPercent === 0} />
        <Row label={`Processing fee (${METHOD_FEES[method].label})`} value={money(b.processingCents)} />
        <div style={{ borderTop: `1px solid ${BD}`, marginTop: 4, paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: GRT }}>
            <span>Recipient receives</span>
            <span>{money(b.netToRecipientCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: INK, marginTop: 8 }}>
            <span>You pay</span>
            <span>{money(b.totalChargedCents)}</span>
          </div>
        </div>
      </div>

      <p style={{ margin: '18px 0 0', fontSize: 13, lineHeight: 1.6, color: MU }}>
        {coverProcessing ? (
          <>
            <strong style={{ color: GRT }}>100% of your donation</strong> reaches the recipient — you&apos;ve
            covered the {METHOD_FEES[method].label} processor fee. CharitMe&apos;s platform fee is{' '}
            <strong>always 0%</strong>.
          </>
        ) : (
          <>
            The recipient receives your donation minus the {METHOD_FEES[method].label} processor fee that
            Stripe charges. CharitMe&apos;s platform fee is <strong>always 0%</strong> — none of this goes to us.
          </>
        )}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: muted ? 'var(--t4, #94a3b8)' : 'var(--t2, #334155)' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
