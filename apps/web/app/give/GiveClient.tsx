'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Btn, Card, Input, EmptyState } from '../../components/ui';
import { splitEvenly, MAX_PORTFOLIO_CAMPAIGNS, MIN_PORTFOLIO_SHARE_CENTS } from '../../lib/portfolio-split';
import { formatMoney, formatMoneyShort, DEFAULT_CURRENCY } from '@shared/currencies';
import {
  DEFAULT_DONATION_CHECKOUT_SETTINGS,
  donationBreakdown,
  normalizeDonationCheckoutSettings,
  type CheckoutPaymentMethod,
  type DonationCheckoutSettings,
} from '@shared/fees';

export interface GiveCampaign {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  category: string;
  cover_image_url: string | null;
  raised_amount: number;
  goal_amount: number;
}

// One amount, several campaigns. The split is shown live and to the cent BEFORE
// checkout, because "we divide it for you" is only trustworthy if the donor can
// see exactly what each campaign receives — including which one gets the spare
// cent when the division is not clean.

const PAYMENT_OPTIONS: { id: CheckoutPaymentMethod; label: string; mark: string }[] = [
  { id: 'stripe', label: 'Stripe', mark: 'S' },
  { id: 'gpay', label: 'Google Pay', mark: 'G' },
  { id: 'bank', label: 'Bank transfer', mark: 'B' },
  { id: 'card', label: 'Credit or debit', mark: 'C' },
];

export default function GiveClient({
  campaigns,
  checkoutSettings = DEFAULT_DONATION_CHECKOUT_SETTINGS,
  checkoutRevision = 'defaults',
}: {
  campaigns: GiveCampaign[];
  checkoutSettings?: DonationCheckoutSettings;
  checkoutRevision?: string;
}) {
  const checkout = useMemo(() => normalizeDonationCheckoutSettings(checkoutSettings), [checkoutSettings]);
  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState(String(checkout.popularAmountCents / 100));
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  const [tipPercent, setTipPercent] = useState(checkout.defaultSupportPercent);
  const [customTip, setCustomTip] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('stripe');
  const [methodOpen, setMethodOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = Math.round(Number.parseFloat(amount || '0') * 100);
  const customTipCents = useMemo(() => {
    if (customTip === null || customTip.trim() === '') return null;
    const parsed = Number.parseFloat(customTip);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
  }, [customTip]);
  const checkoutBreakdown = useMemo(() => donationBreakdown({
    amountCents: totalCents,
    supportPercent: tipPercent,
    ...(customTipCents !== null ? { supportCentsOverride: customTipCents } : {}),
    method: paymentMethod,
    methodFees: checkout.methodFees,
    coverProcessing: true,
  }), [checkout.methodFees, customTipCents, paymentMethod, tipPercent, totalCents]);

  const split = useMemo(
    () => (selected.length > 0 && totalCents > 0 ? splitEvenly(totalCents, selected) : []),
    [selected, totalCents],
  );

  const perCampaignTooSmall =
    split.length > 0 && split.some((p) => p.amountCents < MIN_PORTFOLIO_SHARE_CENTS);

  function toggle(id: string) {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PORTFOLIO_CAMPAIGNS) {
        setError(`You can support up to ${MAX_PORTFOLIO_CAMPAIGNS} campaigns in one gift.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function give() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/donations/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          campaignIds: selected,
          totalCents,
          anonymous,
          message: message.trim() || undefined,
          tipPercent,
          ...(customTipCents !== null ? { tipCents: customTipCents } : {}),
          coverProcessingFee: true,
          paymentMethod,
          checkoutRevision,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Could not start checkout.');
        return;
      }
      window.location.href = json.url;
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const byId = new Map(campaigns.map((c) => [c.id, c]));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>
          1. How much would you like to give?
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--t3)' }}>
          CharitMe takes <strong>0%</strong>. Every cent below reaches the campaigns you choose.
        </p>
        <div role="radiogroup" aria-label="Donation amount" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {checkout.amountPresetsCents.map((cents) => {
            const active = totalCents === cents;
            return (
              <button
                key={cents}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAmount(String(cents / 100))}
                style={{
                  minHeight: 56,
                  position: 'relative',
                  border: `2px solid ${active ? 'var(--violet)' : 'var(--b2)'}`,
                  borderRadius: 8,
                  background: active ? 'var(--violet)' : 'var(--s1)',
                  color: active ? '#fff' : 'var(--t1)',
                  fontWeight: 800,
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                {formatMoneyShort(cents, DEFAULT_CURRENCY)}
                {cents === checkout.popularAmountCents && (
                  <span style={{ display: 'block', marginTop: 2, fontSize: 9, fontWeight: 800, letterSpacing: 0 }}>
                    MOST POPULAR
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <label style={{ display: 'block', marginTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--t3)' }}>
          Enter custom amount
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, border: '1px solid var(--b2)', borderRadius: 8, padding: '0 12px', minHeight: 48 }}>
            <span aria-hidden="true">$</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--t1)', font: 'inherit', fontSize: 16 }}
            />
            <span>USD</span>
          </span>
        </label>
        <div style={{ marginTop: 14, padding: 14, borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--b1)' }}>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>You&rsquo;re giving</span>
          <strong style={{ display: 'block', marginTop: 3, fontSize: 28, color: 'var(--t1)' }}>
            {formatMoney(totalCents, DEFAULT_CURRENCY)}
          </strong>
        </div>
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>
          2. Choose the causes
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--t3)' }}>
          Pick up to {MAX_PORTFOLIO_CAMPAIGNS}. Selected: <strong>{selected.length}</strong>
        </p>

        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns available right now"
            body="Nothing is live to fund at the moment. Browse every fundraiser instead."
          />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: 14,
            }}
          >
            {campaigns.map((c) => {
              const on = selected.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: `2px solid ${on ? 'var(--violet-ink)' : 'var(--b1)'}`,
                      background: on ? 'var(--tint-violet)' : 'var(--s1)',
                      borderRadius: 'var(--rl)',
                      padding: 14,
                      transition: 'border-color .15s, background .15s',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 14.5, color: 'var(--t1)', lineHeight: 1.35 }}>
                      {c.title}
                    </strong>
                    {c.tagline && (
                      <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, color: 'var(--t3)' }}>
                        {c.tagline}
                      </span>
                    )}
                    <span style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--t4)' }}>
                      {c.category} · {formatMoneyShort(c.raised_amount, DEFAULT_CURRENCY)} raised
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--t1)' }}>
          3. Your split
        </h2>
        {split.length === 0 ? (
          <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--t3)' }}>
            Choose an amount and at least one campaign to see the breakdown.
          </p>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
              {split.map((p) => (
                <li
                  key={p.campaignId}
                  style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', gap: 12, fontSize: 13.5, color: 'var(--t2)' }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {byId.get(p.campaignId)?.title ?? p.campaignId}
                  </span>
                  <strong style={{ color: 'var(--t1)', whiteSpace: 'nowrap' }}>
                    {formatMoneyShort(p.amountCents, DEFAULT_CURRENCY)}
                  </strong>
                </li>
              ))}
            </ul>
            <div
              style={{
                borderTop: '1px solid var(--b1)',
                marginTop: 12,
                paddingTop: 12,
                display: 'flex', flexWrap: 'wrap', minWidth: 0,
                justifyContent: 'space-between',
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--t1)',
              }}
            >
              <span>Total</span>
              <span>{formatMoneyShort(totalCents, DEFAULT_CURRENCY)}</span>
            </div>
            {/* Stated because an uneven division is otherwise mistaken for a bug.
                The parts always sum to the total exactly — the spare cents go to
                the first campaigns in the list. */}
            {totalCents % split.length !== 0 && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--t4)' }}>
                This amount does not divide evenly, so the spare {totalCents % split.length}
                {totalCents % split.length === 1 ? ' cent goes' : ' cents go'} to the first campaigns
                listed. The parts always add up to exactly your total.
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0 }}>
              Payment method &amp; processing fee estimate
            </p>
            <button
              type="button"
              aria-expanded={methodOpen}
              aria-controls="portfolio-payment-methods"
              onClick={() => setMethodOpen((open) => !open)}
              style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1.5px solid var(--violet)', borderRadius: 8, background: 'var(--s1)', color: 'var(--t1)', cursor: 'pointer' }}
            >
              <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 6, background: 'var(--s2)', fontWeight: 800 }}>
                {PAYMENT_OPTIONS.find((option) => option.id === paymentMethod)?.mark}
              </span>
              <strong style={{ flex: 1, textAlign: 'left' }}>{PAYMENT_OPTIONS.find((option) => option.id === paymentMethod)?.label}</strong>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>{checkout.methodFees[paymentMethod].label}</span>
              <span aria-hidden="true">{methodOpen ? '▴' : '▾'}</span>
            </button>
            {methodOpen && (
              <div id="portfolio-payment-methods" role="radiogroup" aria-label="Payment method" style={{ marginTop: 8, border: '1px solid var(--b2)', borderRadius: 8, overflow: 'hidden' }}>
                {PAYMENT_OPTIONS.map((option, index) => (
                  <label key={option.id} style={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: index ? '1px solid var(--b1)' : 0, background: paymentMethod === option.id ? 'var(--s2)' : 'var(--s1)', cursor: 'pointer' }}>
                    <input type="radio" name="portfolio-payment-method" checked={paymentMethod === option.id} onChange={() => setPaymentMethod(option.id)} />
                    <span style={{ width: 24, fontWeight: 800 }}>{option.mark}</span>
                    <strong style={{ flex: 1 }}>{option.label}</strong>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{checkout.methodFees[option.id].label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0 }}>
              CharitMe fee
            </p>
            <button
              type="button"
              aria-expanded={serviceOpen}
              aria-controls="portfolio-service-fee"
              onClick={() => setServiceOpen((open) => !open)}
              style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1.5px solid var(--violet)', borderRadius: 8, background: 'var(--s1)', color: 'var(--t1)', cursor: 'pointer' }}
            >
              <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 6, background: 'var(--s2)' }}>♥</span>
              <strong style={{ flex: 1, textAlign: 'left' }}>CharitMe</strong>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>{customTipCents !== null ? formatMoney(customTipCents, DEFAULT_CURRENCY) : `${tipPercent}%`}</span>
              <span aria-hidden="true">{serviceOpen ? '▴' : '▾'}</span>
            </button>
            {serviceOpen && (
              <div id="portfolio-service-fee" style={{ marginTop: 8, padding: 12, border: '1px solid var(--b2)', borderRadius: 8 }}>
                <div role="radiogroup" aria-label="Optional CharitMe fee" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7 }}>
                  {checkout.supportTierPercents.map((percent) => (
                    <button
                      key={percent}
                      type="button"
                      role="radio"
                      aria-checked={customTip === null && tipPercent === percent}
                      onClick={() => { setCustomTip(null); setTipPercent(percent); }}
                      style={{ minHeight: 48, border: `1.5px solid ${customTip === null && tipPercent === percent ? 'var(--violet)' : 'var(--b2)'}`, borderRadius: 8, background: customTip === null && tipPercent === percent ? 'var(--s2)' : 'var(--s1)', color: 'var(--t1)', fontWeight: 800, cursor: 'pointer' }}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
                <label style={{ display: 'block', marginTop: 10, fontSize: 12, color: 'var(--t3)' }}>
                  Custom CharitMe fee (USD)
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={customTip ?? ''}
                    placeholder="Enter an amount"
                    onChange={(event) => setCustomTip(event.target.value)}
                    style={{ width: '100%', minHeight: 44, marginTop: 5, padding: '8px 10px', border: '1px solid var(--b2)', borderRadius: 8, background: 'var(--s1)', color: 'var(--t1)', fontSize: 16 }}
                  />
                </label>
              </div>
            )}
          </div>

          <div style={{ padding: 14, border: '1px solid var(--b1)', borderRadius: 8, background: 'var(--s2)' }}>
            {[
              ['Donation', checkoutBreakdown.donationCents],
              ['CharitMe fee (optional)', checkoutBreakdown.supportCents],
              [`${PAYMENT_OPTIONS.find((option) => option.id === paymentMethod)?.label ?? 'Stripe'} processing estimate`, checkoutBreakdown.processingCents],
            ].map(([label, cents]) => (
              <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 7, fontSize: 13, color: 'var(--t2)' }}>
                <span>{label}</span>
                <strong>{formatMoney(Number(cents), DEFAULT_CURRENCY)}</strong>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingTop: 10, borderTop: '1px solid var(--b2)', fontSize: 16, color: 'var(--t1)' }}>
              <strong>You pay</strong>
              <strong>{formatMoney(checkoutBreakdown.totalChargedCents, DEFAULT_CURRENCY)}</strong>
            </div>
          </div>

          <label style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--t2)' }}>
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Give anonymously
          </label>
          <Input
            label="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Shown to each campaign you support."
            maxLength={500}
          />
          {perCampaignTooSmall && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>
              Each campaign must receive at least ${(MIN_PORTFOLIO_SHARE_CENTS / 100).toFixed(2)}. Raise the
              amount or choose fewer campaigns.
            </p>
          )}
          {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>{error}</p>}
          <div>
            <Btn
              onClick={give}
              loading={loading}
              disabled={selected.length === 0 || totalCents <= 0 || perCampaignTooSmall}
            >
              Give {totalCents > 0 ? formatMoney(checkoutBreakdown.totalChargedCents, DEFAULT_CURRENCY) : ''} to {selected.length || 'these'}{' '}
              {selected.length === 1 ? 'campaign' : 'campaigns'}
            </Btn>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--t4)' }}>
            One payment, one receipt.{' '}
            <Link href="/campaigns" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
              Browse all campaigns
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
