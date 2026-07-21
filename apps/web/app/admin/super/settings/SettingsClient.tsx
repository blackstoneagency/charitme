'use client';

import React, { useState } from 'react';

export type PlatformConfig = {
  platformName?: string; tagline?: string; supportEmail?: string; supportPhone?: string;
  currency?: string; platformFeePercent?: number; donationFeePercent?: number;
  defaultDonorTipPercent?: number; maintenanceMode?: boolean; allowNewRegistrations?: boolean;
};

const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--b2)', background: 'var(--s1)', color: 'var(--t1)', fontSize: 13 };
const btn: React.CSSProperties = { padding: '10px 20px', borderRadius: 9, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 };

function Field({ label, k, value, type = 'text', ph, onSet }: { label: string; k: keyof PlatformConfig; value: string | number | undefined; type?: string; ph?: string; onSet: (k: keyof PlatformConfig, v: unknown) => void }) {
  return (
    <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block' }}>{label}
      <input style={input} type={type} placeholder={ph} value={value ?? ''}
        onChange={(e) => onSet(k, type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)} />
    </label>
  );
}

function Toggle({ label, k, on, warn, onSet }: { label: string; k: keyof PlatformConfig; on: boolean; warn?: boolean; onSet: (k: keyof PlatformConfig, v: unknown) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--t2)', padding: '8px 0' }}>
      <button type="button" onClick={() => onSet(k, !on)} aria-pressed={on}
        style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? (warn ? 'var(--red)' : 'var(--green)') : 'var(--b3)', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
      </button>
      {label}
    </label>
  );
}

export default function SettingsClient({ config: initial }: { config: PlatformConfig }) {
  const [c, setC] = useState<PlatformConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const set = (k: keyof PlatformConfig, v: unknown) => setC((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/super/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setC(j.config); flash('Settings saved');
    } catch (e) { flash(`Error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  return (
    <div style={{ padding: '0 4px 48px', maxWidth: 820 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <section className="kf-card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Branding</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <Field label="Platform name" k="platformName" value={c.platformName} ph="CharitMe" onSet={set} />
            <Field label="Tagline" k="tagline" value={c.tagline} onSet={set} />
            <Field label="Support email" k="supportEmail" value={c.supportEmail} ph="hello@charitme.com" onSet={set} />
            <Field label="Support phone" k="supportPhone" value={c.supportPhone} onSet={set} />
          </div>
        </section>
        <section className="kf-card" style={{ padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Fees &amp; currency</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <Field label="Default currency (ISO)" k="currency" value={c.currency} ph="USD" onSet={set} />
            <Field label="Platform fee %" k="platformFeePercent" value={c.platformFeePercent} type="number" onSet={set} />
            <Field label="Processing fee %" k="donationFeePercent" value={c.donationFeePercent} type="number" onSet={set} />
            <Field label="Default donor tip %" k="defaultDonorTipPercent" value={c.defaultDonorTipPercent} type="number" onSet={set} />
          </div>
        </section>
      </div>

      <section className="kf-card" style={{ padding: 18, marginTop: 18 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Platform controls</h3>
        <Toggle label="Allow new registrations" k="allowNewRegistrations" on={!!c.allowNewRegistrations} onSet={set} />
        <Toggle label="Maintenance mode (shows a maintenance banner)" k="maintenanceMode" on={!!c.maintenanceMode} warn onSet={set} />
      </section>

      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button style={btn} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        <span style={{ color: 'var(--t3)', fontSize: 12 }}>Applies platform-wide immediately.</span>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--t1)', color: 'var(--bg)', padding: '10px 16px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 50 }}>{toast}</div>}
    </div>
  );
}
