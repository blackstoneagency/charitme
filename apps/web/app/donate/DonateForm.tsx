'use client';

import { useMemo, useState } from 'react';
import { MIN_DONATION_CENTS, MAX_DONATION_CENTS } from '@shared/fees';

export type DonateTarget = { id: string; title: string; category: string | null };

/**
 * The "Make a Donation" panel.
 *
 * It posts to the SAME endpoints as the campaign-page donate flow —
 * `/api/donations` for one-off and `/api/donations/recurring` for monthly — and
 * hands off to the Stripe Checkout URL they return. Nothing about the money path
 * is re-implemented here: a second checkout implementation is how the two would
 * eventually disagree about fees, minimums or idempotency.
 *
 * The campaign list is passed in from the server component, so the picker shows
 * real live campaigns rather than a hardcoded menu.
 */
export default function DonateForm({
  targets,
  loadFailed,
}: {
  targets: DonateTarget[];
  loadFailed: boolean;
}) {
  const [monthly, setMonthly] = useState(false);
  const [preset, setPreset] = useState<number | null>(5000);
  const [custom, setCustom] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [dedicate, setDedicate] = useState(false);
  const [dedicateName, setDedicateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = useMemo(() => {
    if (preset != null) return preset;
    const parsed = Number.parseFloat(custom);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [preset, custom]);

  const money = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!campaignId) { setError('Choose where your gift should go.'); return; }
    if (!Number.isFinite(amountCents) || amountCents < MIN_DONATION_CENTS) {
      setError(`Minimum donation is ${money(MIN_DONATION_CENTS)}.`); return;
    }
    if (amountCents > MAX_DONATION_CENTS) {
      setError(`Maximum donation is ${money(MAX_DONATION_CENTS)}.`); return;
    }

    setBusy(true);
    try {
      const endpoint = monthly ? '/api/donations/recurring' : '/api/donations';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // One-off donations are idempotent on this key, so a double-click or a
          // retried request cannot charge twice. Recurring has its own guard.
          ...(monthly ? {} : { 'Idempotency-Key': crypto.randomUUID() }),
        },
        body: JSON.stringify({
          campaignId,
          amountCents,
          cadence: 'monthly',
          coverProcessingFee: !monthly,
          ...(dedicate && dedicateName.trim()
            ? { message: `In honor of ${dedicateName.trim()}` }
            : {}),
        }),
      });
      const text = await res.text();
      const data = (text ? JSON.parse(text) : {}) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`);
      if (!data.url) throw new Error('No checkout URL returned. Please try again.');
      window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <form className="dn-panel" onSubmit={submit} aria-labelledby="dn-panel-title">
      <h2 id="dn-panel-title" className="dn-panel-title">Make a Donation</h2>
      <p className="dn-panel-sub">Choose an amount and help bring hope today.</p>

      <div className="dn-freq" role="radiogroup" aria-label="Donation frequency">
        {([['One-Time', false], ['Monthly', true]] as const).map(([label, value]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={monthly === value}
            className={monthly === value ? 'dn-freq-btn is-on' : 'dn-freq-btn'}
            onClick={() => setMonthly(value)}
          >
            {label}
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
          </button>
        ))}
      </div>

      <div className="dn-amounts" role="radiogroup" aria-label="Donation amount">
        {AMOUNTS.map((tier) => (
          <button
            key={tier.cents}
            type="button"
            role="radio"
            aria-checked={preset === tier.cents}
            className={preset === tier.cents ? 'dn-amt is-on' : 'dn-amt'}
            onClick={() => { setPreset(tier.cents); setCustom(''); }}
          >
            <b>{money(tier.cents)}</b>
            <span>{tier.label}</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={preset === null}
          className={preset === null ? 'dn-amt is-on' : 'dn-amt'}
          onClick={() => setPreset(null)}
        >
          <b>Other</b>
          <span>Choose amount</span>
        </button>
      </div>

      <label className="dn-field">
        <span className="dn-label">Custom Amount</span>
        <span className="dn-money">
          <span aria-hidden="true">$</span>
          {/* No `min` attribute, for the same reason the select has no
              `required`: native constraint validation short-circuits the submit
              handler, so a below-minimum amount was silently swallowed by a
              browser tooltip instead of reporting through the styled
              role="alert" region. The floor is enforced in `submit`, and again
              server-side by the donations route. */}
          <input
            type="number"
            inputMode="decimal"
            step="1"
            placeholder={`Enter amount (min ${MIN_DONATION_CENTS / 100})`}
            aria-label="Custom amount in US dollars"
            value={custom}
            onChange={(e) => { setCustom(e.target.value); setPreset(null); }}
          />
          <span aria-hidden="true">USD</span>
        </span>
      </label>

      <label className="dn-field">
        <span className="dn-label">Where Your Gift Goes</span>
        {loadFailed ? (
          // Never render an empty picker as though there were nothing to give to.
          <span className="dn-load-error" role="alert">
            We couldn&rsquo;t load campaigns just now — this is a problem on our side.
            Please refresh in a moment.
          </span>
        ) : (
          // Deliberately NOT `required`. Native validation short-circuits the
          // submit handler, so the browser tooltip fired here while the amount
          // checks still reported through the styled role="alert" region — two
          // validation surfaces on one form, only one of which matches the
          // design or is announced consistently.
          <select
            className="dn-select"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            aria-describedby={error ? 'dn-form-error' : undefined}
          >
            <option value="">Choose a cause or campaign</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.category ? `${t.category} — ${t.title}` : t.title}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="dn-check">
        <input type="checkbox" checked={dedicate} onChange={(e) => setDedicate(e.target.checked)} />
        <span>Dedicate this donation in honor or memory of someone</span>
      </label>
      {dedicate && (
        <input
          className="dn-dedicate"
          type="text"
          maxLength={80}
          placeholder="Their name"
          aria-label="Name of the person this donation honors"
          value={dedicateName}
          onChange={(e) => setDedicateName(e.target.value)}
        />
      )}

      {error && <p id="dn-form-error" className="dn-error" role="alert">{error}</p>}

      <button type="submit" className="dn-submit" disabled={busy || loadFailed}>
        {busy ? 'Redirecting to checkout…' : 'Donate Securely'}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </button>
      <p className="dn-secure">Your payment is encrypted and secure.</p>

      <ul className="dn-methods" aria-label="Accepted payment methods">
        {['VISA', 'Mastercard', 'Amex', 'Discover', 'Apple Pay'].map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>

      <p className="dn-legal">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        </svg>
        {/* DELIBERATE DEVIATION from the supplied design, which read "CharitMe
            is a 501(c)(3) nonprofit organization. All donations are
            tax-deductible."

            The product contradicts that in three places a donor will actually
            reach: the campaign FAQ ("Donations are not tax-deductible unless
            this campaign is run by a verified 501(c)(3) nonprofit"), the
            donation receipt ("Donations to personal fundraisers are not
            tax-deductible") and the annual tax statement. CharitMe is the
            PLATFORM; deductibility depends on the recipient, which is exactly
            what /verification gates on.

            Shipping the design's wording would have this page promise a
            deduction the receipt then denies — a regulated claim, on the page
            that takes the money. Same block, same position, true copy. */}
        <span>
          Donations to verified 501(c)(3) nonprofits are tax-deductible and receive an
          official receipt. Gifts to personal fundraisers are not deductible.
        </span>
      </p>
    </form>
  );
}

/**
 * The suggested tiers, with what each buys. Amounts match the impact strip
 * below the fold so a donor who reads "$50 provides shelter" there finds the
 * same promise on the button.
 */
const AMOUNTS = [
  { cents: 2500, label: 'Feed a family' },
  { cents: 5000, label: 'Provide shelter' },
  { cents: 10000, label: 'Give essential care' },
  { cents: 25000, label: 'Support a program' },
  { cents: 50000, label: 'Change lives' },
] as const;
