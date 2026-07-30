'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsPanel({ campaignId }: { campaignId: string }) {
  const router = useRouter();

  // Campaign core settings
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [acceptDonations, setAcceptDonations] = useState(true);

  // Launch settings
  const [fundingModel, setFundingModel] = useState<'flexible' | 'fixed'>('flexible');
  const [currency, setCurrency] = useState('USD');

  const [loading, setLoading] = useState(true);
  const [coreState, setCoreState] = useState<SaveState>('idle');
  const [launchState, setLaunchState] = useState<SaveState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      const [coreRes, launchRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`).catch(() => null),
        fetch(`/api/campaigns/${campaignId}/settings`).catch(() => null),
      ]);

      if (!active) return;

      if (coreRes?.ok) {
        const c = await coreRes.json();
        setVisibility(c.visibility ?? 'public');
        setAcceptDonations(c.accept_donations !== false);
      }

      if (launchRes?.ok) {
        const s = await launchRes.json();
        setFundingModel(s.funding_model ?? 'flexible');
        setCurrency(s.currency ?? 'USD');
      }

      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [campaignId]);

  const saveCoreSettings = async () => {
    setCoreState('saving');
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility, donationsEnabled: acceptDonations }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Save failed');
        setCoreState('error');
        return;
      }
      setCoreState('saved');
      setTimeout(() => setCoreState('idle'), 2000);
    } catch {
      setCoreState('error');
    }
  };

  const saveLaunchSettings = async () => {
    setLaunchState('saving');
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundingModel, currency }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Save failed');
        setLaunchState('error');
        return;
      }
      setLaunchState('saved');
      setTimeout(() => setLaunchState('idle'), 2000);
    } catch {
      setLaunchState('error');
    }
  };

  const deleteCampaign = async () => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard');
    else setError('Delete failed — pause or close the campaign first.');
  };

  const btnLabel = (state: SaveState) =>
    state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved!' : 'Save changes';

  if (loading) {
    return (
      <div style={{ padding: '24px 0', color: 'var(--t3)', fontSize: 14 }}>Loading…</div>
    );
  }

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 650, color: 'var(--t1)' }}>{title}</h2>
      {children}
    </div>
  );

  const field = (label: string, hint: string, children: React.ReactNode) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--t2)', marginBottom: 6 }}>{label}</label>
      {hint && <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>{hint}</div>}
      {children}
    </div>
  );

  const radioGroup = <T extends string>(
    name: string,
    value: T,
    onChange: (v: T) => void,
    options: { value: T; label: string; description: string }[],
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <label key={opt.value} style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
          borderRadius: 10, cursor: 'pointer', border: '1.5px solid',
          borderColor: value === opt.value ? 'var(--violet)' : 'var(--b1)',
          background: value === opt.value ? 'rgba(109,53,255,.12)' : 'var(--s1)',
        }}>
          <input
            type="radio" name={name} value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value as T)}
            aria-label={opt.label}
            style={{ marginTop: 3, accentColor: 'var(--violet)' }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>{opt.label}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{opt.description}</div>
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>Campaign Settings</h2>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,59,95,.08)', border: '1px solid rgba(255,59,95,.28)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Visibility & Donations */}
      {section('Visibility & Donations', <>
        {field('Campaign visibility', 'Control who can find and view this campaign.',
          radioGroup('visibility', visibility, setVisibility, [
            { value: 'public',   label: 'Public',   description: 'Listed in search results and the homepage.' },
            { value: 'unlisted', label: 'Unlisted', description: 'Only visible to people with the direct link.' },
            { value: 'private',  label: 'Private',  description: 'Only you can view this campaign.' },
          ]),
        )}

        {field('Accept donations', 'Pause or resume donations without taking the campaign offline.',
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              role="switch"
              tabIndex={0}
              aria-checked={acceptDonations}
              aria-label="Accept donations"
              onClick={() => setAcceptDonations(v => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAcceptDonations(v => !v); } }}
              style={{
                width: 44, height: 24, borderRadius: 99, cursor: 'pointer',
                background: acceptDonations ? 'var(--violet)' : 'var(--b2)',
                transition: 'background .2s', position: 'relative', flexShrink: 0,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: 'var(--s1)', /* theme-keep: white toggle knob */
                position: 'absolute', top: 3, transition: 'left .2s',
                left: acceptDonations ? 23 : 3,
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
              {acceptDonations ? 'Accepting donations' : 'Donations paused'}
            </span>
          </div>,
        )}

        <button
          onClick={saveCoreSettings}
          disabled={coreState === 'saving'}
          style={{
            background: coreState === 'saved' ? 'var(--green)' : 'var(--violet)',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontWeight: 650, fontSize: 14, cursor: 'pointer',
          }}
        >
          {btnLabel(coreState)}
        </button>
      </>)}

      {/* Launch Settings */}
      {section('Launch Settings', <>
        {field('Funding model', 'Flexible keeps all funds raised even if goal not met.',
          radioGroup('fundingModel', fundingModel, setFundingModel, [
            { value: 'flexible', label: 'Keep it all (Flexible)',  description: 'You keep funds even if the goal isn\'t met.' },
            { value: 'fixed',    label: 'All or nothing (Fixed)',  description: 'Donors are charged only if the goal is reached.' },
          ]),
        )}

        {field('Currency', 'Currency donations are collected in.',
          <select
            aria-label="Campaign currency"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--b1)', fontSize: 14, color: 'var(--t2)' }}
          >
            {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>,
        )}

        <button
          onClick={saveLaunchSettings}
          disabled={launchState === 'saving'}
          style={{
            background: launchState === 'saved' ? 'var(--green)' : 'var(--violet)',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontWeight: 650, fontSize: 14, cursor: 'pointer',
          }}
        >
          {btnLabel(launchState)}
        </button>
      </>)}

      {/* Danger zone */}
      {section('Danger Zone', <>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
          Deleting a campaign is permanent. Active campaigns must be paused or closed first.
        </p>
        <button
          onClick={deleteCampaign}
          style={{
            background: 'none', border: '1.5px solid var(--red)',
            color: 'var(--red)', borderRadius: 10,
            padding: '10px 24px', fontWeight: 650, fontSize: 14, cursor: 'pointer',
          }}
        >
          Delete campaign
        </button>
      </>)}
    </div>
  );
}
