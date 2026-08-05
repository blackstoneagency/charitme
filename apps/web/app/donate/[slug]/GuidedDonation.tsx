'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DONATION_STEP_META,
  stepPosition,
  canGoBack,
  previousStep,
  composeDedicatedMessage,
  isValidDedication,
  validateAmountCents,
  AMOUNT_PRESETS_CENTS,
  DEDICATION_KINDS,
  DEDICATION_PREFIX,
  DEDICATION_NAME_MAX,
  DONATION_MESSAGE_MAX,
  type DedicationKind,
  type Frequency,
} from '../../../lib/donation-flow-core';
import { MIN_DONATION_CENTS, donationTotal, donorTip, processingFee } from '@shared/fees';

/**
 * The guided donation flow — steps 2, 3, 6 and 7 of the reference.
 *
 * ⚠️ **Steps 4, 5 and 8 are Stripe's.** This form collects the amount, the
 * donor's details and their dedication, shows a review, and then hands off to
 * **Stripe Checkout**, which renders the payment-method picker, the card fields
 * and the final confirm on Stripe's own domain. This page never sees a card
 * number, and a test asserts no component in this repo renders one.
 *
 * It posts to the SAME `POST /api/donations` the campaign page uses, so there is
 * one server-side donation path, one set of validations and one webhook — not a
 * parallel checkout that could drift from the one that has been carrying real
 * money.
 */

type Step = 'amount' | 'details' | 'dedicate' | 'review';
const OWN_STEPS: Step[] = ['amount', 'details', 'dedicate', 'review'];

export default function GuidedDonation({
  campaignId,
  campaignTitle,
  campaignSlug,
}: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
}) {
  const [step, setStep] = useState<Step>('amount');
  const [frequency, setFrequency] = useState<Frequency>('once');
  const [amountCents, setAmountCents] = useState<number>(5_000);
  const [customAmount, setCustomAmount] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [dedicationKind, setDedicationKind] = useState<DedicationKind | ''>('');
  const [honoreeName, setHonoreeName] = useState('');
  const [coverFee, setCoverFee] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dedication = dedicationKind && isValidDedication({ kind: dedicationKind, honoreeName })
    ? { kind: dedicationKind, honoreeName }
    : null;
  const finalMessage = composeDedicatedMessage(dedication, message);

  const amountCheck = validateAmountCents(amountCents, MIN_DONATION_CENTS);

  const totals = useMemo(() => {
    if (!amountCheck.ok) return null;
    return {
      tip: donorTip(amountCents),
      processing: processingFee(amountCents),
      total: donationTotal(amountCents, coverFee),
    };
  }, [amountCents, coverFee, amountCheck.ok]);

  function chooseAmount(cents: number) {
    setAmountCents(cents);
    setCustomAmount('');
    setError('');
  }

  function onCustomAmount(value: string) {
    setCustomAmount(value);
    const dollars = Number(value);
    // Rounded, not truncated: 12.345 typed into a dollar field must not become a
    // fractional cent, which Stripe would refuse outright.
    setAmountCents(Number.isFinite(dollars) ? Math.round(dollars * 100) : Number.NaN);
    setError('');
  }

  function goTo(target: Step) {
    setStep(target);
    setError('');
    requestAnimationFrame(() => document.getElementById('guided-step-heading')?.focus());
  }

  async function submit() {
    if (!amountCheck.ok) { setError(amountCheck.reason); goTo('amount'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(frequency === 'once' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
        },
        body: JSON.stringify({
          campaignId,
          amountCents,
          cadence: frequency === 'monthly' ? 'monthly' : undefined,
          message: finalMessage ? finalMessage : undefined,
          anonymous,
          coverProcessingFee: frequency === 'once' ? coverFee : false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? `Server error (${res.status})`); return; }
      if (!data.url) { setError('No checkout URL returned. Please try again.'); return; }
      // Stripe Checkout takes over from here — steps 4, 5 and 8.
      window.location.assign(data.url as string);
    } catch {
      setError('We could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const money = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const meta = DONATION_STEP_META[step];
  const { index, total } = stepPosition(step);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18, minWidth: 0 }}>
      <nav aria-label="Donation steps">
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
          {OWN_STEPS.map((s, i) => {
            const done = OWN_STEPS.indexOf(step) > i;
            const current = s === step;
            return (
              <li key={s} style={{ minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => goTo(s)}
                  aria-current={current ? 'step' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, minWidth: 0,
                    padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    border: `1px solid ${current ? 'var(--brand-text)' : 'var(--b1)'}`,
                    background: current ? 'var(--tint-violet)' : 'var(--s1)', color: 'var(--t1)',
                  }}
                >
                  <span aria-hidden="true" style={{ fontWeight: 800, color: done ? 'var(--green-text)' : 'var(--t3)' }}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span>{DONATION_STEP_META[s].title}</span>
                  <span className="sr-only">{done ? ' (done)' : current ? ' (current step)' : ' (not started)'}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby="guided-step-heading" style={card}>
        <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--t3)' }}>
          Step {index} of {total}
        </p>
        <h2 id="guided-step-heading" tabIndex={-1} style={{ margin: '0 0 14px', fontSize: 21, fontWeight: 800, color: 'var(--t1)', outline: 'none' }}>
          {meta.title}
        </h2>

        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--red-text)' }}>{error}</p>}

        {step === 'amount' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
            <div role="group" aria-label="Donation frequency" style={{ display: 'flex', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
              {(['once', 'monthly'] as Frequency[]).map((f) => (
                <button key={f} type="button" onClick={() => setFrequency(f)} aria-pressed={frequency === f} style={pill(frequency === f)}>
                  {f === 'once' ? 'One-time' : 'Monthly'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 96px), 1fr))', gap: 8 }}>
              {AMOUNT_PRESETS_CENTS.map((c) => (
                <button key={c} type="button" onClick={() => chooseAmount(c)} aria-pressed={amountCents === c && !customAmount} style={pill(amountCents === c && !customAmount)}>
                  {money(c)}
                </button>
              ))}
            </div>

            <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
              <span style={label}>Other amount (USD)</span>
              <input
                inputMode="decimal"
                value={customAmount}
                onChange={(e) => onCustomAmount(e.target.value)}
                placeholder="25.00"
                style={input}
              />
            </label>

            {!amountCheck.ok && (customAmount !== '' ) && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{amountCheck.reason}</p>
            )}
          </div>
        )}

        {step === 'details' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, maxWidth: 520 }}>
            <div style={checkRow}>
              <input id="guided-anon" type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, flex: '0 0 auto' }} aria-describedby="guided-anon-help" />
              <span style={{ minWidth: 0 }}>
                <label htmlFor="guided-anon" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--t1)', cursor: 'pointer' }}>Give anonymously</label>
                <span id="guided-anon-help" style={{ fontSize: 13, color: 'var(--t3)' }}>Your name is hidden from the public donor wall. The organiser still sees the donation.</span>
              </span>
            </div>
            <label htmlFor="guided-message" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
              <span style={label}>Message of support (optional)</span>
              <textarea id="guided-message" value={message} onChange={(e) => setMessage(e.target.value.slice(0, DONATION_MESSAGE_MAX))} rows={3} style={{ ...input, resize: 'vertical' }} />
            </label>
            {/* Your name and email are collected by Stripe Checkout, which needs
                them for the receipt anyway — asking twice would be friction with
                no benefit. */}
            <p style={{ margin: 0, fontSize: 13, color: 'var(--t3)' }}>
              Your name and email are entered securely on the next screen, which is hosted by Stripe.
            </p>
          </div>
        )}

        {step === 'dedicate' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, maxWidth: 520 }}>
            <label htmlFor="guided-dedication" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
              <span style={label}>Dedicate this donation (optional)</span>
              <select id="guided-dedication" value={dedicationKind} onChange={(e) => setDedicationKind(e.target.value as DedicationKind | '')} style={input}>
                <option value="">No dedication</option>
                {DEDICATION_KINDS.map((k) => <option key={k} value={k}>{DEDICATION_PREFIX[k].replace(/:$/, '')}</option>)}
              </select>
            </label>
            {dedicationKind && (
              <label htmlFor="guided-honoree" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 5 }}>
                <span style={label}>Their name</span>
                <input id="guided-honoree" value={honoreeName} onChange={(e) => setHonoreeName(e.target.value.slice(0, DEDICATION_NAME_MAX))} style={input} />
              </label>
            )}
            {dedication && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--t3)' }}>
                Your message will begin: “{DEDICATION_PREFIX[dedication.kind]} {dedication.honoreeName.trim()}”
              </p>
            )}
          </div>
        )}

        {step === 'review' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, maxWidth: 520 }}>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8, fontSize: 14 }}>
              <Row label="Campaign" value={campaignTitle} />
              <Row label="Amount" value={amountCheck.ok ? money(amountCents) : '—'} />
              <Row label="Frequency" value={frequency === 'once' ? 'One-time' : 'Monthly'} />
              {finalMessage && <Row label="Your message" value={finalMessage} />}
              <Row label="Anonymous" value={anonymous ? 'Yes' : 'No'} />
            </dl>

            {frequency === 'once' && totals && (
              <div style={checkRow}>
                <input id="guided-cover" type="checkbox" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, flex: '0 0 auto' }} aria-describedby="guided-cover-help" />
                <span style={{ minWidth: 0 }}>
                  <label htmlFor="guided-cover" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--t1)', cursor: 'pointer' }}>
                    Cover the fees so {money(amountCents)} reaches the campaign
                  </label>
                  <span id="guided-cover-help" style={{ fontSize: 13, color: 'var(--t3)' }}>
                    Adds {money(totals.tip + totals.processing)} — total {money(totals.total)}. The platform takes 0%.
                  </span>
                </span>
              </div>
            )}

            <p style={{ margin: 0, fontSize: 13, color: 'var(--t3)' }}>
              The next screen is hosted by Stripe, where you choose how to pay and enter your card.
              We never see your card details.
            </p>

            <div>
              <button type="button" onClick={() => void submit()} disabled={busy || !amountCheck.ok} className="kf-primary" style={{ minHeight: 44 }}>
                {busy ? 'Starting secure checkout…' : 'Continue to secure payment'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 18, minWidth: 0 }}>
          {canGoBack(step) && OWN_STEPS.includes(previousStep(step) as Step) && (
            <button type="button" onClick={() => goTo(previousStep(step) as Step)} style={linkBtn}>← Back</button>
          )}
          {step !== 'review' && (
            <button
              type="button"
              onClick={() => goTo(OWN_STEPS[OWN_STEPS.indexOf(step) + 1]!)}
              disabled={step === 'amount' && !amountCheck.ok}
              className="kf-primary"
              style={{ minHeight: 44, opacity: step === 'amount' && !amountCheck.ok ? 0.6 : 1 }}
            >
              Next
            </button>
          )}
          <Link href={`/campaigns/${campaignSlug}`} style={{ ...linkStyle, fontSize: 13, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
            Back to the campaign
          </Link>
        </div>
      </section>
    </div>
  );
}

function Row({ label: l, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <dt style={{ color: 'var(--t3)', fontWeight: 650 }}>{l}</dt>
      <dd style={{ margin: 0, color: 'var(--t1)', fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>{value}</dd>
    </div>
  );
}

const card: React.CSSProperties = { padding: 20, border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)', minWidth: 0 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--t2)' };
const input: React.CSSProperties = {
  width: '100%', minWidth: 0, maxWidth: '100%', padding: '11px 12px', fontSize: 15, fontFamily: 'inherit',
  color: 'var(--t1)', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', minHeight: 44,
};
const checkRow: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0,
  padding: 12, border: '1px solid var(--b1)', borderRadius: 'var(--r)', background: 'var(--s2)',
};
const pill = (active: boolean): React.CSSProperties => ({
  minHeight: 44, minWidth: 0, padding: '10px 16px', borderRadius: 999, cursor: 'pointer',
  fontSize: 14, fontWeight: 700, color: 'var(--t1)',
  border: `1px solid ${active ? 'var(--brand-text)' : 'var(--b1)'}`,
  background: active ? 'var(--tint-violet)' : 'var(--s1)',
});
const linkBtn: React.CSSProperties = {
  fontSize: 13, fontWeight: 650, color: 'var(--t2)', background: 'none', border: 'none',
  padding: '11px 0', minHeight: 44, cursor: 'pointer', textDecoration: 'underline',
};
const linkStyle = { color: 'var(--brand-text)', fontWeight: 650 } as const;
