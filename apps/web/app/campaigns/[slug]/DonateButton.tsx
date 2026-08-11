'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  MAX_DONATION_CENTS,
  DEFAULT_DONATION_CHECKOUT_SETTINGS,
  donationBreakdown,
  normalizeDonationCheckoutSettings,
  type CheckoutPaymentMethod,
  type DonationCheckoutSettings,
} from '@shared/fees';
import { createClient } from '../../../lib/supabase-browser';
import { formatMoney, formatMoneyShort, currencySymbol, DEFAULT_CURRENCY } from '@shared/currencies';
import EmployerMatchWidget from './EmployerMatchWidget';

/* ── Design tokens (CSS-variable-aware for dark mode) ──── */
const V   = 'var(--violet, #6c35ff)';
// Brand FILL vs brand INK. `--violet` is a fill; as small text it measured
// 3.06:1 and 2.83:1 on the dark card — AA failures. `--brand-text` is the
// readable counterpart and flips with the theme, so every `color:` use of the
// brand hue goes through VT.
const VT  = 'var(--brand-text)';
const VL  = 'var(--s2, #f5f0ff)';
const VD  = '#4d1ee0';          // only used inside gradient on coloured bg — stays hex
const GR  = 'var(--green, #059669)';
// Green FILL vs green INK, same split as V/VT below: --green measured 2.88:1
// as 13px text on the breakdown card, an AA failure.
const GRT = 'var(--green-text)';
const BD  = 'var(--b2, #e2d9ff)';
const MU  = 'var(--t3, #64748b)';
const INK = 'var(--t1, #1a1a2e)';

type FrequencyMode = 'once' | 'monthly';

interface PayOption { id: CheckoutPaymentMethod; label: string; icon: React.ReactNode }

// Only methods Stripe Checkout can actually fulfil for this account are offered.
// PayPal and Venmo were previously listed but are NOT in ONE_TIME_PAYMENT_METHOD_TYPES
// (and the connected account has no such capability), so a donor picking them was
// quoted a fee for a method they could never use — Venmo's lower rate also
// under-collected the real card cost, which the platform then absorbed. Keep this
// list in sync with lib/stripe-payment-methods.ts.
const PAY_OPTIONS: PayOption[] = [
  { id: 'stripe',  label: 'Stripe',         icon: <span style={{ fontWeight: 700, fontSize: 13, color: '#635bff' }}>S</span> },
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

/* ── Tip tier presentation: icon + label per support % (matches design) ── */
const ICON_STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
type TipIconName =
  | 'heartFill' | 'star' | 'thumb' | 'smile' | 'heart' | 'clap' | 'gift'
  | 'none' | 'hand' | 'shield' | 'check' | 'lock' | 'shieldCheck';
function TipIcon({ name }: { name: TipIconName }) {
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
// ⚠️ Keyed by PERCENT, not by position.
//
// This list used to be a positional array indexed against
// `checkout.supportTierPercents` — which is loaded from `platform_settings` and
// is editable from /admin/super/settings. Any edit that inserted, removed or
// reordered a tier silently slid every label one place along, so "Recommended"
// would end up under whatever percentage happened to occupy that slot. The
// labels are a claim about a specific rate, so they are attached to the rate.
const TIP_TIER_PRESENTATION: Record<number, { label: string; icon: TipIconName }> = {
  15: { label: 'Incredible!', icon: 'heartFill' },
  12: { label: 'Great', icon: 'star' },
  10: { label: 'Recommended', icon: 'thumb' },
  8: { label: 'Nice', icon: 'smile' },
  5: { label: 'Thanks', icon: 'heart' },
  3: { label: 'Little bit', icon: 'clap' },
  1: { label: 'Any help counts', icon: 'gift' },
  0: { label: 'No fee', icon: 'none' },
};
// An admin can add a tier this map has never seen (say 20%). Rendering a blank
// label there would look broken; borrowing a neighbour's label would be a
// wrong claim. A neutral one is the only honest option.
const TIP_TIER_FALLBACK = { label: 'Thank you', icon: 'heart' } as const;

export default function DonateButton({
  campaignId,
  campaignTitle,
  utm,
  currency = DEFAULT_CURRENCY,
  checkoutSettings = DEFAULT_DONATION_CHECKOUT_SETTINGS,
  checkoutRevision = 'defaults',
  peerFundraiserId,
}: {
  campaignId: string;
  campaignTitle: string;
  utm?: UtmProps;
  currency?: string;
  checkoutSettings?: DonationCheckoutSettings;
  checkoutRevision?: string;
  /**
   * Set only when the donor arrived through a supporter's page
   * (`/campaigns/[slug]/team/[peerSlug]`). Credits that supporter as well as the
   * parent campaign. Re-verified server-side against the campaign — this prop is
   * a convenience, not the authority.
   */
  peerFundraiserId?: string;
}) {
  const checkout = useMemo(() => normalizeDonationCheckoutSettings(checkoutSettings), [checkoutSettings]);
  const money      = (cents: number) => formatMoney(cents, currency);
  const moneyShort = (cents: number) => formatMoneyShort(cents, currency);
  const symbol     = currencySymbol(currency);
  const recommended = checkout.popularAmountCents;

  const [frequency, setFrequency]         = useState<FrequencyMode>('once');
  const [amount, setAmount]               = useState(String(recommended / 100));
  const [subscribeEmail, setSubscribeEmail] = useState(false);
  const [anonymous, setAnonymous]         = useState(false);
  const [message, setMessage]             = useState('');
  const [tipPercent, setTipPercent]       = useState<number>(checkout.defaultSupportPercent);
  // Custom support amount, entered in whole currency units. null = using a tier %.
  // Kept as a string so the field can be empty while typing without snapping to 0.
  const [customTip, setCustomTip]         = useState<string | null>(null);
  // Reveals the custom donation-amount field (the big figure is editable, but a
  // plain number is not a discoverable affordance).
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  // Guards the window between a click and React re-rendering the disabled
  // button. A ref, because state does not update synchronously.
  const submittingRef = useRef(false);
  /**
   * One idempotency key per checkout ATTEMPT.
   *
   * Minted when an attempt begins and reused for anything that retries within
   * it, so Stripe returns the original Checkout Session rather than creating a
   * second. Cleared when the attempt ends, so a donor who genuinely gives again
   * gets a new session.
   */
  const attemptKeyRef = useRef<string>('');
  const customAmountRef = useRef<HTMLInputElement>(null);
  const customTipRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [guestEmail, setGuestEmail]       = useState('');
  const [isGuest, setIsGuest]             = useState<boolean | null>(null);
  const [preferredMethod, setPreferredMethod] = useState<CheckoutPaymentMethod>('stripe');
  const [serviceOpen, setServiceOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);

  const amountCents = Math.round((Number.parseFloat(amount) || 0) * 100);
  const isMonthly   = frequency === 'monthly';

  // A custom support amount is authoritative to the cent. null while the donor is
  // on a tier %, or while the custom field is blank/invalid (so an empty field
  // doesn't momentarily charge $0 before they finish typing).
  const customTipCents = useMemo(() => {
    if (customTip == null) return null;
    const trimmed = customTip.trim();
    if (trimmed === '') return null;
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [customTip]);

  const breakdown = useMemo(() => {
    // Single source of truth shared with the server + calculator (see @shared/fees).
    const b = donationBreakdown({
      amountCents,
      supportPercent: tipPercent,
      // Sent to the API as tipCents too, so what's shown here is exactly what the
      // card is charged — no percentage round-trip in between.
      ...(customTipCents != null ? { supportCentsOverride: customTipCents } : {}),
      method: preferredMethod,
      methodFees: checkout.methodFees,
      coverProcessing: !isMonthly,
    });
    return {
      tip: b.supportCents,
      processing: b.processingCents,
      total: b.totalChargedCents,
      netToRecipient: b.netToRecipientCents,
    };
  }, [amountCents, tipPercent, customTipCents, isMonthly, preferredMethod, checkout.methodFees]);

  const handleDonate = async () => {
    // ⚠️ Synchronous re-entry guard, set BEFORE any await.
    //
    // `disabled={loading}` alone does not close this: `setLoading(true)` used to
    // run AFTER `await supabase.auth.getUser()`, so between the click and the
    // re-render the button was still live. Two rapid clicks both got through and
    // created two Stripe Checkout Sessions. A ref updates synchronously, which is
    // the only thing that can guard a window that closes before React re-renders.
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (!attemptKeyRef.current) attemptKeyRef.current = crypto.randomUUID();

    if (Number.isNaN(amountCents) || amountCents < 100) { submittingRef.current = false; setError(`Minimum donation is ${money(100)}`); return; }
    if (amountCents > MAX_DONATION_CENTS)               { submittingRef.current = false; setError(`Maximum donation is ${moneyShort(MAX_DONATION_CENTS)}`); return; }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Both of these hand control back to the donor, so the guard has to be
    // released or the button stays dead for the rest of the page's life.
    if (!user && isGuest === null) { submittingRef.current = false; setIsGuest(true); return; }
    if (!user && !guestEmail.trim()) { submittingRef.current = false; setError('Please enter your email to receive a receipt.'); return; }

    setError('');
    setLoading(true);

    try {
      const endpoint = isMonthly ? '/api/donations/recurring' : '/api/donations';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ⚠️ Stable for the whole attempt, NOT generated per fetch.
          //
          // `crypto.randomUUID()` inline here produced a new key on every call,
          // which made Stripe's idempotency inert: a retried or duplicated POST
          // was a different key and therefore a second Checkout Session. The key
          // is minted once per attempt below and reused, so a retry of the same
          // attempt returns Stripe's original session instead of a new one.
          ...(!isMonthly ? { 'Idempotency-Key': attemptKeyRef.current } : {}),
        },
        body: JSON.stringify({
          campaignId,
          amountCents,
          cadence: 'monthly',
          message: message.trim() ? message : undefined,
          anonymous,
          coverProcessingFee: !isMonthly,
          tipPercent,
          // Exact custom support amount wins server-side, so the donor is charged
          // the figure shown in the breakdown above to the cent.
          ...(customTipCents != null ? { tipCents: customTipCents } : {}),
          paymentMethod: preferredMethod,
          checkoutRevision,
          donorEmail: !user && guestEmail.trim() ? guestEmail.trim() : undefined,
          subscribeToUpdates: subscribeEmail,
          // Share attribution — forwarded from landing URL
          ...(utm?.utmSource    ? { utmSource:    utm.utmSource }    : {}),
          ...(utm?.utmMedium    ? { utmMedium:    utm.utmMedium }    : {}),
          ...(utm?.utmCampaign  ? { utmCampaign:  utm.utmCampaign }  : {}),
          ...(utm?.utmContent   ? { utmContent:   utm.utmContent }   : {}),
          ...(utm?.shareEventId ? { shareEventId: utm.shareEventId } : {}),
          ...(utm?.referrerId   ? { referrerId:   utm.referrerId }   : {}),
          ...(peerFundraiserId ? { peerFundraiserId } : {}),
        }),
      });
      const text = await res.text();
      const data = (text ? JSON.parse(text) : {}) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);
      if (!data.url) throw new Error('No checkout URL returned. Please try again.');
      // `assign()` rather than `location.href = …`: the react-hooks
      // immutability rule treats assigning to a value defined outside the
      // component as a mutation. Same navigation, same history behaviour.
      window.location.assign(data.url!);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
      // Release the attempt. The guard has to go or the button stays dead; the
      // key goes with it because the donor may change the amount before trying
      // again, and reusing the key would return Stripe's session for the OLD
      // amount. Duplicate POSTs *within* one attempt are what the key prevents;
      // a deliberate retry afterwards is a new attempt.
      submittingRef.current = false;
      attemptKeyRef.current = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: VL, color: VT, display: 'grid', placeItems: 'center', padding: 10 }}>
            <TipIcon name="hand" />
          </span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Choose an amount</div>
            <div style={{ fontSize: 13, color: MU, marginTop: 2 }}>Your generosity powers our mission.</div>
          </div>
        </div>
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 6, color: MU, fontSize: 11.5, fontWeight: 700, flexShrink: 0, textAlign: 'right', lineHeight: 1.2 }}>
          <span style={{ width: 18, height: 18, color: VT, flexShrink: 0 }}><TipIcon name="lock" /></span>
          <span>Secure &amp;<br />Trusted</span>
        </div>
      </div>

      {/* ── Frequency toggle ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 0, background: 'var(--s3, #f0eaff)', borderRadius: 14, padding: 4 }}>
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
              // VT, not V: the brand violet as button TEXT measured 3.06:1 on
              // the dark card. White on the green FILL is unaffected.
              color: frequency === f ? (f === 'monthly' ? '#fff' : VT) : MU,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: frequency === f ? '0 2px 10px rgba(0,0,0,.12)' : 'none',
              transition: 'all .15s',
              display: 'flex', minWidth: 0,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {f === 'once' ? 'Give Once' : <>Give Monthly <span style={{ fontSize: 16 }}>🌱</span></>}
          </button>
        ))}
      </div>

      {/* The fee reassurance, the reward-tier picker and the AI donor nudge all
          used to sit here, between the frequency toggle and the preset amounts.
          They were removed deliberately: the block is now toggle → amount, with
          nothing in between. The reward tiers went with them, which is why this
          component no longer takes a `rewards` prop and the campaign page no
          longer queries `campaign_rewards` — nothing else consumed either. */}

      {/* ── Preset amounts ── */}
      <div role="radiogroup" aria-label="Donation amount" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 4 }}>
        {checkout.amountPresetsCents.map((preset) => {
          const active = amountCents === preset;
          const popular = preset === recommended;
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setAmount(String(preset / 100));
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
                letterSpacing: 0,
                cursor: 'pointer',
                boxShadow: active ? '0 10px 24px rgba(108,53,255,.28)' : 'none',
                transition: 'border-color .15s, background .15s, color .15s, box-shadow .15s',
              }}
            >
              {moneyShort(preset)}
              {popular && (
                <span style={{
                  position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 9.5, fontWeight: 800, letterSpacing: 0, whiteSpace: 'nowrap',
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

      {/* ── Custom donation amount ──
          The big figure below is editable, but a bare number reads as display-only,
          so donors who want an off-preset amount need an explicit affordance. */}
      {!showCustomAmount ? (
        <button
          type="button"
          onClick={() => {
            setShowCustomAmount(true);
            // Focus after paint so the field exists.
            requestAnimationFrame(() => customAmountRef.current?.focus());
          }}
          style={{
            display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 7,
            width: '100%', padding: '11px 8px', marginTop: 2,
            border: `1.5px dashed ${BD}`, borderRadius: 14, background: 'transparent',
            color: VT, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg viewBox="0 0 24 24" width={15} height={15} style={ICON_STROKE as React.CSSProperties} aria-hidden>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Enter Custom Amount
        </button>
      ) : (
        <div style={{ marginTop: 2 }}>
          <label htmlFor="custom-donation-amount" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: MU, marginBottom: 6 }}>
            Custom donation amount
          </label>
          <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, border: `1.5px solid ${V}`, borderRadius: 14, padding: '10px 14px', background: 'var(--s1, #fff)' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: INK }}>{symbol}</span>
            <input
              id="custom-donation-amount"
              ref={customAmountRef}
              type="number"
              min="1"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                setAmount(val);
              }}
              placeholder="0.00"
              style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: INK, fontFamily: 'inherit', fontSize: 20, fontWeight: 800, padding: 0 }}
            />
            <button
              type="button"
              onClick={() => { setShowCustomAmount(false); setAmount(String(recommended / 100)); }}
              style={{ border: 0, background: 'transparent', color: MU, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Use presets
            </button>
          </div>
        </div>
      )}

      {/* ── "You're giving" — big editable amount + currency + reassurance ── */}
      <div style={{ background: VL, borderRadius: 16, padding: '16px 18px', border: `1px solid ${BD}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: VT, whiteSpace: 'nowrap' }}>You&rsquo;re giving</span>
            <span style={{ display: 'inline-flex', alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: INK }}>{symbol}</span>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val);
                }}
                placeholder="0"
                aria-label="Donation amount"
                style={{ width: '4ch', maxWidth: 160, border: 0, fontSize: 40, fontWeight: 800, letterSpacing: 0, outline: 'none', background: 'transparent', color: INK, fontFamily: 'inherit', padding: 0 }}
              />
              {isMonthly && <span style={{ fontSize: 15, color: MU, fontWeight: 700 }}>/mo</span>}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, marginTop: 12, color: MU, fontSize: 13 }}>
          <span style={{ width: 18, height: 18, color: VT, flexShrink: 0 }}><TipIcon name="shieldCheck" /></span>
          Thank you! Your contribution makes a difference.
        </div>
      </div>

      {/* ── Payment method & processing fee — labeled dropdown ── */}
      <div>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0 }}>
          Payment method &amp; processing fee estimate
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 11.5, lineHeight: 1.45, color: MU }}>
          Stripe Checkout confirms the payment methods available for your currency and device. This selection estimates processing fees; you choose the final method securely on Stripe&apos;s checkout page.
        </p>
        {(() => {
          const sel = PAY_OPTIONS.find((o) => o.id === preferredMethod) ?? PAY_OPTIONS[0];
          const selFee = checkout.methodFees[sel.id];
          // ⚠️ Collapsed, this row carries BOTH charges. Hiding the CharitMe fee
          // behind this dropdown is only acceptable while the summary still
          // states it. Expanded, the two are itemised separately — each method
          // shows its own processor rate, and the CharitMe row shows ours — so
          // the combined form appears ONLY where nothing else is visible.
          //
          // A custom amount is shown in currency rather than as a percent:
          // "+ $7.50" is what the donor actually chose, and re-deriving a
          // percentage would round and disagree with the breakdown below.
          const feeRate = customTipCents != null ? `+ ${money(customTipCents)}` : `+ ${tipPercent}%`;
          const collapsedRate = methodOpen ? selFee.label : `${selFee.label} ${feeRate}`;
          return (
            <button
              type="button"
              onClick={() => setMethodOpen((o) => !o)}
              aria-expanded={methodOpen}
              aria-controls="payment-method-panel"
              aria-label={`Payment method: ${sel.label}, ${collapsedRate}. Tap to ${methodOpen ? 'collapse' : 'expand'} the options, including the CharitMe fee.`}
              style={{
                width: '100%', display: 'flex', minWidth: 0, alignItems: 'center', gap: 12,
                padding: '13px 16px', background: 'var(--s1, #fff)',
                border: `1.5px solid ${methodOpen ? V : BD}`, borderRadius: 14,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .15s',
              }}
            >
              <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--s2, #f5f5f5)', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {sel.icon}
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: INK }}>{sel.label}</span>
              <span style={{ fontSize: 11, color: MU, fontWeight: 600, whiteSpace: 'nowrap' }}>{collapsedRate}</span>
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
              const feeCfg = checkout.methodFees[opt.id];
              return (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex', minWidth: 0, alignItems: 'center', gap: 12,
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
                  <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--s2, #f5f5f5)', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {opt.icon}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 800 : 600, color: active ? VT : INK }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 11, color: active ? INK : MU, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {feeCfg.label}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Optional CharitMe fee — revealed by the payment dropdown ───────

          Gated on `methodOpen`, so it appears when a donor opens the payment
          selector rather than sitting beneath it as a second, always-open
          accordion. Two peer accordions read as two unrelated charges; one
          disclosure that expands into "here is the processor's fee, and here is
          ours" reads as a single breakdown.

          ⚠️ This is NOT a way to bury the fee, and the collapsed payment row is
          what makes that true: it states the combined rate INCLUDING this one
          ("2.9% + $0.30 + 15%"), and the breakdown below itemises it in real
          currency. It stays one click from 0% — support is optional and never
          forced, the rule this file already carried. */}
      {methodOpen && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0 }}>
            CharitMe fee
          </p>
          <button
            type="button"
            onClick={() => setServiceOpen((o) => !o)}
            aria-expanded={serviceOpen}
            aria-controls="service-fee-panel"
            aria-label={`CharitMe fee: ${customTipCents != null ? money(customTipCents) : `${tipPercent}%`}. Tap to ${serviceOpen ? 'collapse' : 'expand'} the options.`}
            style={{
              width: '100%', display: 'flex', minWidth: 0, alignItems: 'center', gap: 12,
              padding: '13px 16px', background: 'var(--s1, #fff)',
              border: `1.5px solid ${serviceOpen ? V : BD}`, borderRadius: 14,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .15s',
            }}
          >
            <span style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--s2, #f5f5f5)', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {/* CharitMe brand mark — transparent-background PNG that reads on the
                  theme-adaptive (--s2) chip in both dark and light mode. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="CharitMe" width={20} height={20} style={{ display: 'block' }} />
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: INK }}>CharitMe</span>
            <span style={{ fontSize: 13, color: MU, fontWeight: 700, whiteSpace: 'nowrap' }}>{customTipCents != null ? money(customTipCents) : `${tipPercent}%`}</span>
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
              <div role="radiogroup" aria-label="Optional CharitMe fee" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                {checkout.supportTierPercents.map((p) => {
                  const active = customTip === null && tipPercent === p;
                  const meta = TIP_TIER_PRESENTATION[p] ?? TIP_TIER_FALLBACK;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setCustomTip(null); setTipPercent(p); }}
                      role="radio"
                      aria-checked={active}
                      aria-label={`Set support to ${p} percent (${meta.label})`}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '9px 2px', borderRadius: 12,
                        border: `1.5px solid ${active ? V : BD}`,
                        background: active ? VL : 'var(--s1, #fff)',
                        color: active ? VT : MU, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s',
                      }}
                    >
                      <span style={{ width: 20, height: 20 }}><TipIcon name={meta.icon} /></span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: active ? VT : INK }}>{p}%</span>
                      {active
                        ? <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', background: V, padding: '1px 5px', borderRadius: 999, whiteSpace: 'nowrap' }}>{meta.label}</span>
                        : <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1.15, textAlign: 'center' }}>{meta.label}</span>}
                    </button>
                  );
                })}
              </div>

              {/* ── Custom support amount ──
                  A percentage ladder can't express "I want to give exactly $7". The
                  entered figure is charged to the cent (sent as tipCents), and the
                  equivalent % is shown so the donor can sanity-check it. */}
              {customTip == null ? (
                <button
                  type="button"
                  onClick={() => { setCustomTip(''); requestAnimationFrame(() => customTipRef.current?.focus()); }}
                  style={{
                    display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 7,
                    width: '100%', padding: '10px 8px', marginTop: 10,
                    border: `1.5px dashed ${BD}`, borderRadius: 12, background: 'transparent',
                    color: VT, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <svg viewBox="0 0 24 24" width={14} height={14} style={ICON_STROKE as React.CSSProperties} aria-hidden>
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Enter Custom Amount
                </button>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <label htmlFor="custom-tip-amount" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: MU, marginBottom: 6 }}>
                    Custom support amount
                  </label>
                  <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, border: `1.5px solid ${V}`, borderRadius: 12, padding: '9px 12px', background: 'var(--s1, #fff)' }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: INK }}>{symbol}</span>
                    <input
                      id="custom-tip-amount"
                      ref={customTipRef}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      placeholder="0.00"
                      aria-describedby="custom-tip-equiv"
                      style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: INK, fontFamily: 'inherit', fontSize: 17, fontWeight: 800, padding: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => setCustomTip(null)}
                      style={{ border: 0, background: 'transparent', color: MU, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Use $
                    </button>
                  </div>
                  <p id="custom-tip-equiv" style={{ margin: '6px 0 0', fontSize: 11.5, color: MU }}>
                    {customTipCents != null && amountCents > 0
                      ? `${money(customTipCents)} — about ${(Math.round((customTipCents / amountCents) * 1000) / 10)}% of your ${money(amountCents)} gift.`
                      : 'Enter any amount you like — support is always optional.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Dedicate this donation: REMOVED ──────────────────────────────
          The "Dedicate this donation (optional)" select and its honoree-name
          field were removed on request.

          Nothing else changes about what is stored: the dedication was never a
          column, it was composed INTO `message`, which is still collected below
          and still posted. Existing donations that carry a composed dedication
          in their message are untouched and still render on the donor wall. */}

      {/* ── Optional message of support ── */}
      <div>
        <label htmlFor="donor-message" style={{ display: 'block', fontSize: 12, fontWeight: 900, color: MU, textTransform: 'uppercase', letterSpacing: 0, marginBottom: 8 }}>
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
            // 16px minimum: below it iOS zooms the page on focus and never zooms back.
            padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
            background: 'var(--s1, #fff)', color: INK,
          }}
        />
        <div style={{ fontSize: 11, color: MU, marginTop: 4, textAlign: 'right' }}>{message.length}/500</div>
      </div>

      {/* ── Checkboxes ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--t2, #4c5679)', fontWeight: 600, lineHeight: 1.5 }}>
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: V, marginTop: 2, flexShrink: 0 }}
          />
          Don&apos;t display my name or profile publicly on the fundraiser
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: `1px solid ${BD}`, fontSize: 10, color: MU, flexShrink: 0, cursor: 'help' }} title="Your name will not appear on the donor list">ⓘ</span>
        </label>
        <label style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--t2, #4c5679)', fontWeight: 600, lineHeight: 1.5 }}>
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
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--b2, #fcd34d)', borderRadius: 9, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', outline: 'none', background: 'var(--s1, #fff)', color: INK }}
          />
        </div>
      )}

      {/* ── Transparent breakdown ── */}
      <div style={{ background: 'var(--s2, #f9f7ff)', borderRadius: 14, padding: '16px 18px', border: `1px solid ${BD}` }}>
        <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: MU, textTransform: 'uppercase', letterSpacing: 0 }}>
          Breakdown
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <BRow label={isMonthly ? 'Monthly donation' : 'Donation'} value={money(amountCents)} />
          {/* ── ONE fees line, and the label is the whole point ──────────────
              The requested breakdown is three rows, so the CharitMe fee and the
              processing estimate are summed into a single line here.

              ⚠️ That line is called "Fees (estimated)", NOT "Processing fee".
              Measured from a build that used the latter: a $50 donation with a
              $122.00 custom CharitMe fee and $5.29 of Stripe processing rendered
              as

                  Processing Fee (Estimated)      $127.29

              Every figure was arithmetically right and the recipient still
              received $50, so nothing looked broken. It simply told the donor
              that STRIPE charged $127.29, when Stripe charged $5.29 and the
              other $122.00 was our own optional, donor-set fee — 24x the
              processor's actual charge, attributed to the wrong party.

              Summing is fine; naming the sum after one of its parts is not. The
              split stays available to anyone who wants it: the CharitMe fee has
              its own adjustable row in the payment disclosure directly above,
              and `title`/`aria-label` carry the itemisation here for pointer and
              screen-reader users alike. */}
          <BRow
            label={isMonthly ? 'Fees (estimated) — covered by CharitMe' : 'Fees (estimated)'}
            value={money(breakdown.tip + breakdown.processing)}
            detail={
              breakdown.tip > 0
                ? `CharitMe fee ${money(breakdown.tip)} + processing ${money(breakdown.processing)}`
                : `Processing only — no CharitMe fee`
            }
          />
          {amountCents > 0 && !isMonthly && (
            <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: GRT }}>
              <span>Recipient receives</span>
              <span>{money(breakdown.netToRecipient)}</span>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${BD}`, marginTop: 4, paddingTop: 10, display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: INK }}>
            <span>You pay{isMonthly ? '/month' : ''}</span>
            <span>{money(breakdown.total)}</span>
          </div>
          {/* Recipient always receives the full donation — tip + processing are
              added on top, never deducted (Stripe Connect destination charge). */}
          <div style={{ marginTop: 6, padding: '9px 11px', borderRadius: 9, background: 'rgba(16,185,129,.10)', display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, fontWeight: 750, color: 'var(--green-dark, #047857)' }}>
            <span>✓ {campaignTitle ? 'Recipient' : 'They'} receive{isMonthly ? '' : 's'} {money(amountCents)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>100% of your donation</span>
          </div>
        </div>
      </div>

      {/* Employer matching-gift estimator — optional, additive; reads the current
          amount and never alters the donation or checkout. */}
      {!isMonthly && <EmployerMatchWidget amountCents={amountCents} />}

      {error && (
        <p style={{ margin: 0, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.12)', color: 'var(--red-text)', fontSize: 13, fontWeight: 700, border: '1px solid #fecdd3' }}>
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
          letterSpacing: 0,
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

/**
 * One line of the breakdown.
 *
 * `detail` itemises a summed row. It is exposed through BOTH `title` (pointer)
 * and `aria-label` (assistive tech) rather than `title` alone, because a
 * tooltip-only disclosure is invisible to keyboard and screen-reader users —
 * and the row it exists for is the one that combines our fee with the
 * processor's. Whoever is reading, the split is available.
 */
function BRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', fontSize: 14, color: MU }}
      {...(detail ? { title: detail, 'aria-label': `${label}: ${value}. ${detail}.` } : {})}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 650, color: INK }}>{value}</span>
    </div>
  );
}
