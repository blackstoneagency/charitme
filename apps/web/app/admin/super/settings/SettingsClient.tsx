'use client';

import React, { useState } from 'react';
import {
  DEFAULT_DONATION_CHECKOUT_SETTINGS,
  CHECKOUT_PAYMENT_METHODS,
  normalizeDonationCheckoutSettings,
  type CheckoutPaymentMethod,
  type DonationCheckoutSettings,
} from '@shared/fees';

export type PlatformConfig = {
  platformName?: string; tagline?: string; supportEmail?: string; supportPhone?: string;
  currency?: string; maintenanceMode?: boolean; allowNewRegistrations?: boolean;
  maintenanceMessage?: string; maintenanceExpectedBackAt?: string;
  donationCheckout?: DonationCheckoutSettings;
  /** Stored under config.payment; surfaced here in DOLLARS and sent as cents. */
  featuredCampaignPriceDollars?: number;
};

const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 13 };
const btn: React.CSSProperties = { padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--green-btn)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 };

function Field({ label, k, value, type = 'text', ph, onSet }: { label: string; k: keyof PlatformConfig; value: string | number | undefined; type?: string; ph?: string; onSet: (k: keyof PlatformConfig, v: unknown) => void }) {
  return (
    <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block' }}>{label}
      <input style={input} type={type} placeholder={ph} value={value ?? ''}
        onChange={(e) => onSet(k, type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)} />
    </label>
  );
}

function NumericField({
  label,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block' }}>
      {label}
      <input
        style={input}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

function toDateTimeLocal(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Toggle({ label, k, on, warn, onSet }: { label: string; k: keyof PlatformConfig; on: boolean; warn?: boolean; onSet: (k: keyof PlatformConfig, v: unknown) => void }) {
  return (
    <label style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--t2)', padding: '8px 0' }}>
      <button type="button" onClick={() => onSet(k, !on)} aria-pressed={on}
        style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? (warn ? 'var(--red)' : 'var(--green)') : 'var(--b3)', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: 'var(--s1)', transition: 'left .15s' }} />
      </button>
      {label}
    </label>
  );
}

export default function SettingsClient({ config: initial }: { config: PlatformConfig }) {
  const [c, setC] = useState<PlatformConfig>({
    ...initial,
    maintenanceExpectedBackAt: toDateTimeLocal(initial.maintenanceExpectedBackAt),
    donationCheckout: normalizeDonationCheckoutSettings(initial.donationCheckout),
  });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const set = (k: keyof PlatformConfig, v: unknown) => setC((p) => ({ ...p, [k]: v }));
  const setCheckout = (update: (current: DonationCheckoutSettings) => DonationCheckoutSettings) => {
    setC((current) => ({
      ...current,
      donationCheckout: update(current.donationCheckout ?? DEFAULT_DONATION_CHECKOUT_SETTINGS),
    }));
  };

  async function save() {
    setBusy(true);
    try {
      // Dollars in the field, CENTS on the wire — the API stores cents, and a
      // number that means a different unit at each end is how a $5 fee becomes
      // a $500 one. The dollars key is stripped so it is never persisted
      // alongside the cents value it duplicates.
      const { featuredCampaignPriceDollars, ...rest } = c;
      const payload: Record<string, unknown> = { ...rest };
      payload.maintenanceExpectedBackAt = c.maintenanceExpectedBackAt
        ? new Date(c.maintenanceExpectedBackAt).toISOString()
        : '';
      const dollars = Number(featuredCampaignPriceDollars);
      if (Number.isFinite(dollars) && dollars > 0) {
        payload.featuredCampaignPriceCents = Math.round(dollars * 100);
      }
      const res = await fetch('/api/admin/super/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      // Re-surface the saved cents as dollars so the field shows what was stored
      // rather than reverting to blank.
      const savedCents = Number((j.config?.payment as Record<string, unknown> | undefined)?.featuredCampaignPriceCents);
      const savedPayment = j.config?.payment && typeof j.config.payment === 'object' && !Array.isArray(j.config.payment)
        ? (j.config.payment as Record<string, unknown>)
        : {};
      setC({
        ...j.config,
        maintenanceExpectedBackAt: toDateTimeLocal(j.config?.maintenanceExpectedBackAt),
        featuredCampaignPriceDollars: Number.isFinite(savedCents) && savedCents > 0 ? savedCents / 100 : undefined,
        donationCheckout: normalizeDonationCheckoutSettings(savedPayment.donationCheckout),
      });
      flash('Settings saved');
    } catch (e) { flash(`Error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  const checkout = c.donationCheckout ?? DEFAULT_DONATION_CHECKOUT_SETTINGS;
  const methodLabels: Record<CheckoutPaymentMethod, string> = {
    stripe: 'Stripe',
    gpay: 'Google Pay',
    bank: 'Bank transfer',
    card: 'Credit or debit',
  };

  return (
    <div style={{ padding: '0 4px 48px', maxWidth: 820 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18 }}>
        <section className="kf-card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Branding</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            <Field label="Platform name" k="platformName" value={c.platformName} ph="CharitMe" onSet={set} />
            <Field label="Tagline" k="tagline" value={c.tagline} onSet={set} />
            <Field label="Support email" k="supportEmail" value={c.supportEmail} ph="hello@charitme.com" onSet={set} />
            <Field label="Support phone" k="supportPhone" value={c.supportPhone} onSet={set} />
          </div>
        </section>
        <section className="kf-card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Fees &amp; currency</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
            <Field label="Default currency (ISO)" k="currency" value={c.currency} ph="USD" onSet={set} />
            <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block' }}>
              Mandatory platform fee
              <input style={input} value="0%" readOnly aria-readonly="true" />
            </label>
            <Field
              label="Featured campaign price (USD, one-time)"
              k="featuredCampaignPriceDollars"
              value={c.featuredCampaignPriceDollars}
              type="number"
              ph="5"
              onSet={set}
            />
          </div>
        </section>
      </div>

      <section className="kf-card" style={{ padding: 18, marginTop: 18 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Donation checkout &amp; CharitMe fee</h3>
        <p style={{ margin: '0 0 16px', color: 'var(--t3)', fontSize: 12.5, lineHeight: 1.5 }}>
          These values power every campaign, peer, embed, direct, recurring, and multi-campaign checkout.
        </p>

        <h4 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Donation amount buttons</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
          {checkout.amountPresetsCents.map((cents, index) => (
            <NumericField
              key={`amount-${index}`}
              label={`Amount ${index + 1} (USD)`}
              value={cents / 100}
              min={1}
              max={1_000_000}
              step={0.01}
              onChange={(dollars) => setCheckout((current) => {
                const amountPresetsCents = [...current.amountPresetsCents];
                const previous = amountPresetsCents[index] ?? 0;
                const nextCents = Math.round(dollars * 100);
                amountPresetsCents[index] = nextCents;
                return {
                  ...current,
                  amountPresetsCents,
                  popularAmountCents: current.popularAmountCents === previous ? nextCents : current.popularAmountCents,
                };
              })}
            />
          ))}
          <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block' }}>
            Most popular amount
            <select
              style={input}
              value={checkout.popularAmountCents}
              onChange={(event) => setCheckout((current) => ({ ...current, popularAmountCents: Number(event.target.value) }))}
            >
              {checkout.amountPresetsCents.map((cents, index) => (
                <option key={`popular-amount-${index}`} value={cents}>${(cents / 100).toLocaleString()}</option>
              ))}
            </select>
          </label>
        </div>

        <h4 style={{ margin: '20px 0 10px', fontSize: 13.5 }}>Optional CharitMe fee choices</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 10 }}>
          {checkout.supportTierPercents.map((percent, index) => (
            <NumericField
              key={`support-${index}`}
              label={`Choice ${index + 1} (%)`}
              value={percent}
              min={0}
              max={100}
              step={0.1}
              onChange={(nextPercent) => setCheckout((current) => {
                const supportTierPercents = [...current.supportTierPercents];
                const previous = supportTierPercents[index] ?? 0;
                supportTierPercents[index] = nextPercent;
                return {
                  ...current,
                  supportTierPercents,
                  defaultSupportPercent: current.defaultSupportPercent === previous ? nextPercent : current.defaultSupportPercent,
                };
              })}
            />
          ))}
          <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block' }}>
            Default CharitMe fee
            <select
              style={input}
              value={checkout.defaultSupportPercent}
              onChange={(event) => setCheckout((current) => ({ ...current, defaultSupportPercent: Number(event.target.value) }))}
            >
              {checkout.supportTierPercents.map((percent, index) => (
                <option key={`default-support-${index}`} value={percent}>{percent}%</option>
              ))}
            </select>
          </label>
        </div>

        <h4 style={{ margin: '20px 0 4px', fontSize: 13.5 }}>Payment processing estimates</h4>
        {CHECKOUT_PAYMENT_METHODS.map((method) => {
          const fee = checkout.methodFees[method];
          return (
            <div
              key={method}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10, alignItems: 'end', padding: '12px 0', borderTop: '1px solid var(--b1)' }}
            >
              <strong style={{ fontSize: 13, paddingBottom: 11 }}>{methodLabels[method]}</strong>
              <NumericField
                label="Percent"
                value={fee.pct}
                min={0}
                max={20}
                step={0.01}
                onChange={(pct) => setCheckout((current) => ({
                  ...current,
                  methodFees: { ...current.methodFees, [method]: { ...current.methodFees[method], pct } },
                }))}
              />
              <NumericField
                label="Fixed fee (USD)"
                value={fee.fixed / 100}
                min={0}
                max={100}
                step={0.01}
                onChange={(dollars) => setCheckout((current) => ({
                  ...current,
                  methodFees: { ...current.methodFees, [method]: { ...current.methodFees[method], fixed: Math.round(dollars * 100) } },
                }))}
              />
              {method === 'bank' ? (
                <NumericField
                  label="Maximum fee (USD)"
                  value={(fee.cap ?? 0) / 100}
                  min={0}
                  max={1_000}
                  step={0.01}
                  onChange={(dollars) => setCheckout((current) => ({
                    ...current,
                    methodFees: { ...current.methodFees, bank: { ...current.methodFees.bank, cap: Math.round(dollars * 100) } },
                  }))}
                />
              ) : <span aria-hidden="true" />}
            </div>
          );
        })}
      </section>

      <section className="kf-card" style={{ padding: 18, marginTop: 18 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Platform controls</h3>
        <Toggle label="Allow new registrations" k="allowNewRegistrations" on={!!c.allowNewRegistrations} onSet={set} />
        <Toggle label="Maintenance mode (redirects visitors to the maintenance page)" k="maintenanceMode" on={!!c.maintenanceMode} warn onSet={set} />
        {c.maintenanceMode && (
          <div className="super-maintenance-fields">
            <label>
              Maintenance message
              <textarea
                style={{ ...input, minHeight: 92, resize: 'vertical' }}
                maxLength={240}
                value={c.maintenanceMessage ?? ''}
                placeholder="Tell visitors what is happening and when to check back."
                onChange={(event) => set('maintenanceMessage', event.target.value)}
              />
              <span>{(c.maintenanceMessage ?? '').length}/240</span>
            </label>
            <Field
              label="Expected return (optional)"
              k="maintenanceExpectedBackAt"
              value={c.maintenanceExpectedBackAt}
              type="datetime-local"
              onSet={set}
            />
            <a href="/maintenance" target="_blank" rel="noreferrer">Preview maintenance page</a>
          </div>
        )}
      </section>

      <div style={{ marginTop: 20, display: 'flex', minWidth: 0, gap: 12, alignItems: 'center' }}>
        <button style={btn} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        <span style={{ color: 'var(--t3)', fontSize: 12 }}>Applies platform-wide immediately.</span>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--t1)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
