'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  MAX_DONATION_CENTS,
  DEFAULT_DONOR_TIP_PERCENT,
  SUPPORT_TIER_PERCENTS,
  donationBreakdown,
  METHOD_FEES,
  type PaymentMethod,
} from '@shared/fees';
import { createClient } from '../../../lib/supabase-browser';
import { formatMoney, formatMoneyShort, currencySymbol, DEFAULT_CURRENCY } from '@shared/currencies';

/* ── Design tokens (CSS-variable-aware for dark mode) ──── */
const V   = 'var(--violet, #6c35ff)';
const VL  = 'var(--s2, #f5f0ff)';
const VD  = '#4d1ee0';          // only used inside gradient on coloured bg — stays hex
const GR  = 'var(--green, #059669)';
const BD  = 'var(--b2, #e2d9ff)';
const MU  = 'var(--t3, #64748b)';
const INK = 'var(--t1, #1a1a2e)';

/* Fallback preset amounts when no campaign-tuned asks are provided */
const DEFAULT_PRESETS = [25, 50, 75, 100, 150, 250];

type FrequencyMode = 'once' | 'monthly';

interface PayOption { id: PaymentMethod; label: string; icon: React.ReactNode }

const PAY_OPTIONS: PayOption[] = [
  { id: 'stripe',  label: 'Stripe',         icon: <span style={{ fontWeight: 700, fontSize: 13, color: '#635bff' }}>S</span> },
  { id: 'paypal',  label: 'PayPal',         icon: <span style={{ fontWeight: 700, fontSize: 13, color: '#003087' }}>P</span> },
  { id: 'venmo',   label: 'Venmo',          icon: <span style={{ fontWeight: 700, fontSize: 13, color: '#3D95CE' }}>V</span> },
  { id: 'gpay',    label: 'Google Pay',     icon: <span style={{ fontWeight: 700, fontSize: 13, color: '#4285F4' }}>G</span> },
  { id: 'bank',    label: 'Bank transfer',  icon: <span style={{ fontSize: 14 }}>🏛</span> },
  { id: 'card',    label: 'Credit or debit',icon: <span style={{ fontSize: 14 }}>💳</span> },
];

interface UtmProps {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  shareEventId?: string;
  referrerId?: string;
}

export interface RewardTier {
  id: string;
  title: string;
  description: string | null;
  amount_cents: number;
  estimated_delivery: string | null;
  item_limit: number | null;
  claimed_count: number;
}

/* ── Tip tier presentation: icon + label per support % (matches design) ── */
const ICON_STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function TipIcon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    heartFill: <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z" fill="currentColor" stroke="none" />,
    star: <polygon points="12 2.5 15 9 22 9.7 16.8 14.3 18.4 21 12 17.3 5.6 21 7.2 14.3 2 9.7 9 9" />,
    thumb: <path d="M7 10v11H4V10zM7 10l4-7a2 2 0 0 1 2 2v3h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 21H7" />,
    smile: <><circle cx="12" cy="12" r="9.5" /><path d="M8 14a4.5 4.5 0 0 0 8 0" /><circle cx="9" cy="10" r=".6" fill="currentColor" /><circle cx="15" cy="10" r=".6" fill="currentColor" /></>,
    heart: <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z" />,
    clap: <><path d="M11 11 8 6.5a1.6 1.6 0 0 0-2.8 1.6L8 13" /><path d="M13 12.5 9.5 6a1.6 1.6 0 0 1 2.8-1.6L15 9.5" /><path d="M15.5 10 13 5.8a1.6 1.6 0 0 1 2.8-1.6l2.7 5.3a6 6 0 0 1-10.6 5.6L6 18" /></>,
    gift: <><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8.5h14V12M12 8v12.5M12 8S10.5 3.5 8 4.5 9.5 8 12 8zM12 8s1.5-4.5 4-3.5S14.5 8 12 8z" /></>,
    none: <><circle cx="12" cy="12" r="9.5" /><line x1="5.5" y1="5.5" x2="18.5" y2="18.5" /></>,
    hand: <path d="M6 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4a1.5 1.5 0 0 1 3 0v6m0-.5V5a1.5 1.5 0 0 1 3 0v6m0-2.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.6a5 5 0 0 1-3.5-1.5L4.8 16" />,
    shield: <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
    check: <polyline points="8.5 12.5 11 15 16 9.5" />,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  };
  return <svg viewBox="0 0 24 24" width="100%" height="100%" style={ICON_STROKE as React.CSSProperties} aria-hidden>{name === 'shieldCheck' ? <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><polyline points="8.5 12 11 14.3 16 9.3" /></> : p[name]}</svg>;
}
/** [label, icon] keyed by support %; 0 is the standalone "None" row. */
const TIP_TIER_META: Record<number, { label: string; icon: string }> = {
  15: { label: 'Recommended', icon: 'heartFill' },
  12: { label: 'Great', icon: 'star' },
  10: { label: 'Good', icon: 'thumb' },
  8: { label: 'Nice', icon: 'smile' },
  5: { label: 'Thanks', icon: 'heart' },
  3: { label: 'Little bit', icon: 'clap' },
  1: { label: 'Any help counts', icon: 'gift' },
  0: { label: 'No tip', icon: 'none' },
};

export default function DonateButton({
  campaignId,
  campaignTitle,
  utm,
  rewards,
  currency = DEFAULT_CURRENCY,
  smartPresets,
  recommendedAmount,
}: {
  campaignId: string;
  campaignTitle: string;
  utm?: UtmProps;
  rewards?: RewardTier[];
  currency?: string;
  /** Campaign-tuned ask amounts from the donation optimizer (dollars, ascending). */
  smartPresets?: number[];
  /** Which preset to pre-select and badge as "popular". */
  recommendedAmount?: number;
}) {
  const money      = (cents: number) => formatMoney(cents, currency);
  const moneyShort = (cents: number) => formatMoneyShort(cents, currency);
  const symbol     = currencySymbol(currency);
  /** The preset highlighted as "MOST POPULAR" (donation optimizer, else $50). */
  const recommended = recommendedAmount ?? 50;

  const [frequency, setFrequency]         = useState<FrequencyMode>('once');
  const [amount, setAmount]               = useState(String(recommendedAmount ?? 50));
  const [subscribeEmail, setSubscribeEmail] = useState(false);
  const [anonymous, setAnonymous]         = useState(false);
  const [message, setMessage]             = useState('');
  const [tipPercent, setTipPercent]       = useState<number>(DEFAULT_DONOR_TIP_PERCENT);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [guestEmail, setGuestEmail]       = useState('');
  const [isGuest, setIsGuest]             = useState<boolean | null>(null);
  const [preferredMethod, setPreferredMethod] = useState<PaymentMethod>('stripe');
  const [serviceOpen, setServiceOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [presets, setPresets] = useState<number[]>(smartPresets && smartPresets.length === 6 ? smartPresets : DEFAULT_PRESETS);
  const [aiNudge, setAiNudge] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/ai/donor-conversion?campaignId=${encodeURIComponent(campaignId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { suggestedAmounts?: number[]; message?: string } | null) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.suggestedAmounts) && data.suggestedAmounts.length > 0) {
          setPresets(data.suggestedAmounts);
        }
        if (typeof data.message === 'string' && data.message.trim()) {
          setAiNudge(data.message.trim());
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId]);

  const amountCents = Math.round((Number.parseFloat(amount) || 0) * 100);
  const isMonthly   = frequency === 'monthly';

  const breakdown = useMemo(() => {
    // Single source of truth shared with the server + calculator (see @shared/fees).
    const b = donationBreakdown({
      amountCents,
      supportPercent: tipPercent,
      method: preferredMethod,
      coverProcessing: !isMonthly,
    });
    // Recurring charges settle their processing fee per-cycle via Stripe; the
    // donate form (like before) does not fold it into the shown monthly total,
    // so keep processing off the monthly breakdown to avoid line items that
    // don't sum to "You pay".
    return {
      tip: b.supportCents,
      processing: isMonthly ? 0 : b.processingCents,
      total: b.totalChargedCents,
      netToRecipient: b.netToRecipientCents,
    };
  }, [amountCents, tipPercent, isMonthly, preferredMethod]);

  const handleDonate = async () => {
    if (Number.isNaN(amountCents) || amountCents < 100) { setError(`Minimum donation is ${money(100)}`); return; }
    if (amountCents > MAX_DONATION_CENTS)               { setError(`Maximum donation is ${moneyShort(MAX_DONATION_CENTS)}`); return; }

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
          message: message.trim() ? message.trim() : undefined,
          anonymous,
          coverProcessingFee: !isMonthly,
          tipPercent,
          paymentMethod: preferredMethod,
          donorEmail: !user && guestEmail.trim() ? guestEmail.trim() : undefined,
          subscribeToUpdates: subscribeEmail,
          // Share attribution — forwarded from landing URL
          ...(utm?.utmSource    ? { utmSource:    utm.utmSource }    : {}),
          ...(utm?.utmMedium    ? { utmMedium:    utm.utmMedium }    : {}),
          ...(utm?.utmCampaign  ? { utmCampaign:  utm.utmCampaign }  : {}),
          ...(utm?.utmContent   ? { utmContent:   utm.utmContent }   : {}),
          ...(utm?.shareEventId ? { shareEventId: utm.shareEventId } : {}),
          ...(utm?.referrerId   ? { referrerId:   utm.referrerId }   : {}),
          ...(!isMonthly && selectedRewardId ? { rewardId: selectedRewardId } : {}),
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

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: VL, color: V, display: 'grid', placeItems: 'center', padding: 10 }}>
            <TipIcon name="hand" />
          </span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Choose an amount</div>
            <div style={{ fontSize: 13, color: MU, marginTop: 2 }}>Your generosity powers our mission.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: MU, fontSize: 11.5, fontWeight: 700, flexShrink: 0, textAlign: 'right', lineHeight: 1.2 }}>
          <span style={{ width: 18, height: 18, color: V, flexShrink: 0 }}><TipIcon name="lock" /></span>
          <span>Secure &amp;<br />Trusted</span>
        </div>
      </div>

      {/* ── Frequency toggle ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, background: 'var(--s3, #f0eaff)', borderRadius: 14, padding: 4 }}>
        {(['once', 'monthly'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFrequency(f); setError(''); if (f === 'monthly') setSelectedRewardId(null); }}
            style={{
              padding: '11px 4px',
              border: 0,
              borderRadius: 10,
              background: frequency === f ? (f === 'monthly' ? GR : 'var(--s1, #fff)') : 'transparent',
              color: frequency === f ? (f === 'monthly' ? '#fff' : V) : MU,
              fontWeight: 700,
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
        <div style={{ background: `${GR}12`, borderRadius: 10, padding: '10px 14px', border: `1px solid ${GR}30` }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: GR }}>
            💚 0% platform fee · 100% reaches the campaign
          </div>
          <div style={{ fontSize: 12, color: GR, marginTop: 3, opacity: .85 }}>
            Cancel any time.
          </div>
        </div>
      )}
      {!isMonthly && (
        <div style={{ background: '#f0fff8', borderRadius: 10, padding: '10px 14px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46' }}>0% mandatory platform fee</div>
          <div style={{ fontSize: 12, color: '#065f46', marginTop: 3 }}>
            CharitMe is supported by optional donor tips. Every fee is shown before checkout.
          </div>
        </div>
      )}

      {/* ── Reward / perk tiers (Kickstarter-style, one-time only) ── */}
      {!isMonthly && rewards && rewards.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 900, color: MU, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            🎁 Select a reward (optional)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rewards.map((r) => {
              const soldOut = r.item_limit != null && r.claimed_count >= r.item_limit;
              const active = selectedRewardId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    setSelectedRewardId(r.id);
                    setAmount(String(r.amount_cents / 100));
                    setError('');
                  }}
                  style={{
                    textAlign: 'left',
                    border: `2px solid ${active ? V : BD}`,
                    borderRadius: 12,
                    background: soldOut ? 'var(--s2, #f5f5f5)' : active ? VL : 'var(--s1, #fff)',
                    padding: '12px 14px',
                    cursor: soldOut ? 'not-allowed' : 'pointer',
                    opacity: soldOut ? 0.55 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    fontFamily: 'inherit',
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 900, fontSize: 14, color: active ? V : INK }}>{moneyShort(r.amount_cents)} or more</span>
                    {soldOut && <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>Sold out</span>}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: INK }}>{r.title}</span>
                  {r.description && <span style={{ fontSize: 12, color: MU, lineHeight: 1.5 }}>{r.description}</span>}
                  {(r.estimated_delivery || r.item_limit != null || r.claimed_count > 0) && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: MU, fontWeight: 700, marginTop: 2, flexWrap: 'wrap' }}>
                      {r.estimated_delivery && <span>📦 Est. delivery: {r.estimated_delivery}</span>}
                      {r.item_limit != null
                        ? <span>{Math.max(0, r.item_limit - r.claimed_count)} of {r.item_limit} left</span>
                        : r.claimed_count > 0 ? <span>{r.claimed_count} claimed</span> : null}
                    </div>
                  )}
                </button>
              );
            })}
            {selectedRewardId && (
              <button
                type="button"
                onClick={() => setSelectedRewardId(null)}
                style={{ background: 'none', border: 'none', color: V, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '2px 0', textAlign: 'left', fontFamily: 'inherit' }}
              >
                Remove reward — donate without a perk
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── AI donor conversion nudge ── */}
      {aiNudge && (
        <div style={{ background: 'var(--s2, #f5f3ff)', border: `1px solid ${BD}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--t2, #4338ca)', lineHeight: 1.5 }}>
          ✨ {aiNudge}
        </div>
      )}

      {/* ── Preset amounts — 3×2 grid, personalized via AI Donor Conversion Engine + donation optimizer ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 4 }}>
        {presets.map((preset) => {
          const active = amount === String(preset);
          const popular = preset === recommended;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setAmount(String(preset));
                if (selectedRewardId) {
                  const reward = rewards?.find((r) => r.id === selectedRewardId);
                  if (reward && preset * 100 < reward.amount_cents) setSelectedRewardId(null);
                }
              }}
              style={{
                position: 'relative',
                padding: '20px 4px',
                border: `2px solid ${active ? V : BD}`,
                borderRadius: 16,
                background: active ? `linear-gradient(135deg, ${V}, ${VD})` : 'var(--s1, #fff)',
                color: active ? '#fff' : INK,
                fontWeight: 800,
                fontSize: 26,
                letterSpacing: '-.01em',
                cursor: 'pointer',
                boxShadow: active ? '0 10px 24px rgba(108,53,255,.28)' : 'none',
                transition: 'border-color .15s, background .15s, color .15s, box-shadow .15s',
              }}
            >
              {symbol}{preset.toLocaleString()}
              {popular && (
                <span style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', whiteSpace: 'nowrap',
                  background: active ? '#fff' : V, color: active ? V : '#fff',
                  padding: '3px 9px', borderRadius: 999, boxShadow: '0 4px 12px rgba(108,53,255,.35)',
                }}>
                  <svg viewBox="0 0 24 24" width={10} height={10} aria-hidden><polygon points="12 2.5 15 9 22 9.7 16.8 14.3 18.4 21 12 17.3 5.6 21 7.2 14.3 2 9.7 9 9" fill="currentColor" /></svg>
                  MOST POPULAR
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── "You're giving" — big editable amount + currency + reassurance ── */}
      <div style={{ background: VL, borderRadius: 16, padding: '16px 18px', border: `1px solid ${BD}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: V, whiteSpace: 'nowrap' }}>You&rsquo;re giving</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: INK }}>{symbol}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val);
                  if (selectedRewardId) {
                    const reward = rewards?.find((r) => r.id === selectedRewardId);
                    const cents = Math.round((Number.parseFloat(val) || 0) * 100);
                    if (reward && cents < reward.amount_cents) setSelectedRewardId(null);
                  }
                }}
                placeholder="0"
                aria-label="Donation amount"
                style={{ width: '4ch', maxWidth: 160, border: 0, fontSize: 40, fontWeight: 800, letterSpacing: '-.02em', outline: 'none', background: 'transparent', color: INK, fontFamily: 'inherit', padding: 0 }}
              />
              {isMonthly && <span style={{ fontSize: 15, color: MU, fontWeight: 700 }}>/mo</span>}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: MU, fontSize: 13 }}>
          <span style={{ width: 18, height: 18, color: V, flexShrink: 0 }}><TipIcon name="shieldCheck" /></span>
          Thank you! Your contribution makes a difference.
        </div>
      </div>

      {/* ── Service fee (tip) — labeled dropdown ── */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Service fee
        </p>
        <button
          type="button"
          onClick={() => setServiceOpen((o) => !o)}
          aria-expanded={serviceOpen}
          aria-controls="service-fee-panel"
          aria-label={`Service fee: CharitMe tip ${tipPercent}%. Tap to ${serviceOpen ? 'collapse' : 'expand'} the options.`}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 16px', background: 'var(--s1, #fff)',
            border: `1.5px solid ${serviceOpen ? V : BD}`, borderRadius: 14,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .15s',
          }}
        >
          <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--s2, #f5f5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#f43f5e' }}>
            <span style={{ width: 16, height: 16 }}><TipIcon name="heartFill" /></span>
          </span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: INK }}>CharitMe</span>
          <span style={{ fontSize: 13, color: MU, fontWeight: 700, whiteSpace: 'nowrap' }}>{tipPercent}%</span>
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden style={{ ...(ICON_STROKE as React.CSSProperties), color: MU, flexShrink: 0, transform: serviceOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {serviceOpen && (
          <div id="service-fee-panel" style={{ marginTop: 8, border: `1px solid ${BD}`, borderRadius: 16, padding: '16px 18px', background: 'var(--s1, #fff)' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: INK }}>Tip CharitMe services</span>
            <p style={{ margin: '8px 0 12px', fontSize: 12.5, color: MU, lineHeight: 1.5 }}>
              CharitMe has a 0% platform fee for organizers and relies on the generosity of donors like you to operate our service. Support is optional!
            </p>

            {/* Suggested tiers — icon + % + label */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {SUPPORT_TIER_PERCENTS.map((p) => {
                const active = tipPercent === p;
                const meta = TIP_TIER_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTipPercent(p)}
                    aria-pressed={active}
                    aria-label={`Set support to ${p} percent (${meta.label})`}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '9px 2px', borderRadius: 12,
                      border: `1.5px solid ${active ? V : BD}`,
                      background: active ? VL : 'var(--s1, #fff)',
                      color: active ? V : MU, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
                    }}
                  >
                    <span style={{ width: 20, height: 20 }}><TipIcon name={meta.icon} /></span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: active ? V : INK }}>{p}%</span>
                    {active
                      ? <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', background: V, padding: '1px 5px', borderRadius: 999, whiteSpace: 'nowrap' }}>{meta.label}</span>
                      : <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1.15, textAlign: 'center' }}>{meta.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Payment method & processing fee — labeled dropdown ── */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Payment method &amp; processing fee
        </p>
        {(() => {
          const sel = PAY_OPTIONS.find((o) => o.id === preferredMethod) ?? PAY_OPTIONS[0];
          const selFee = METHOD_FEES[sel.id];
          return (
            <button
              type="button"
              onClick={() => setMethodOpen((o) => !o)}
              aria-expanded={methodOpen}
              aria-controls="payment-method-panel"
              aria-label={`Payment method: ${sel.label}, ${selFee.label}. Tap to ${methodOpen ? 'collapse' : 'expand'} the options.`}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px', background: 'var(--s1, #fff)',
                border: `1.5px solid ${methodOpen ? V : BD}`, borderRadius: 14,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .15s',
              }}
            >
              <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--s2, #f5f5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sel.icon}
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: INK }}>{sel.label}</span>
              <span style={{ fontSize: 11, color: MU, fontWeight: 600, whiteSpace: 'nowrap' }}>{selFee.label}</span>
              <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden style={{ ...(ICON_STROKE as React.CSSProperties), color: MU, flexShrink: 0, transform: methodOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          );
        })()}
        {methodOpen && (
          <div
            id="payment-method-panel"
            role="radiogroup"
            aria-label="Payment method"
            style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8, border: `1.5px solid ${BD}`, borderRadius: 14, overflow: 'hidden' }}
          >
            {PAY_OPTIONS.map((opt, idx) => {
              const active = preferredMethod === opt.id;
              const feeCfg = METHOD_FEES[opt.id];
              return (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px', background: active ? VL : 'var(--s1, #fff)',
                    borderTop: idx > 0 ? `1px solid ${BD}` : 'none',
                    cursor: 'pointer', transition: 'background .15s',
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
        )}
      </div>

      {/* ── Optional message of support ── */}
      <div>
        <label htmlFor="donor-message" style={{ display: 'block', fontSize: 12, fontWeight: 900, color: MU, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Leave a message of support (optional)
        </label>
        <textarea
          id="donor-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          placeholder="Sending love and support…"
          rows={3}
          maxLength={500}
          style={{
            width: '100%', boxSizing: 'border-box', border: `1.5px solid ${BD}`, borderRadius: 12,
            padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
            background: 'var(--s1, #fff)', color: INK,
          }}
        />
        <div style={{ fontSize: 11, color: MU, marginTop: 4, textAlign: 'right' }}>{message.length}/500</div>
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
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: '.07em' }}>
          Breakdown
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <BRow label={isMonthly ? 'Monthly donation' : 'Donation'} value={money(amountCents)} />
          {/* CharitMe support tip + payment-processing fee shown as one combined
              line (both are added on top of the donation, never deducted). */}
          {breakdown.tip + breakdown.processing > 0 && (
            <BRow
              label="Processing & Service Fee"
              value={money(breakdown.tip + breakdown.processing)}
            />
          )}
          {amountCents > 0 && !isMonthly && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: GR }}>
              <span>Recipient receives</span>
              <span>{money(breakdown.netToRecipient)}</span>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${BD}`, marginTop: 4, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: INK }}>
            <span>You pay{isMonthly ? '/month' : ''}</span>
            <span>{money(breakdown.total)}</span>
          </div>
          {/* Recipient always receives the full donation — tip + processing are
              added on top, never deducted (Stripe Connect destination charge). */}
          <div style={{ marginTop: 6, padding: '9px 11px', borderRadius: 9, background: 'rgba(16,185,129,.10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, fontWeight: 750, color: 'var(--green-dark, #047857)' }}>
            <span>✓ {campaignTitle ? 'Recipient' : 'They'} receive{isMonthly ? '' : 's'} {money(amountCents)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, opacity: .85 }}>100% of your donation</span>
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
          fontWeight: 700,
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
      <span style={{ fontWeight: 650, color: INK }}>{value}</span>
    </div>
  );
}
