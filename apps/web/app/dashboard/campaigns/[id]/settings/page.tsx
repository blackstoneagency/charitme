'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function CampaignSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState('');

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
    let active = true;
    void (async () => {
      const { id: resolvedId } = await params;
      if (!active) return;
      setId(resolvedId);

      const [coreRes, launchRes] = await Promise.all([
        fetch(`/api/campaigns/${resolvedId}`).catch(() => null),
        fetch(`/api/campaigns/${resolvedId}/settings`).catch(() => null),
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
  }, [params]);

  const saveCoreSettings = async () => {
    setCoreState('saving');
    setError('');
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
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
      const res = await fetch(`/api/campaigns/${id}/settings`, {
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
    const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard');
    else setError('Delete failed — pause or close the campaign first.');
  };

  const btnLabel = (state: SaveState) =>
    state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved!' : 'Save changes';

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--t3, #94a3b8)' }}>Loading…</div>
    );
  }

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ background: 'var(--s1, #fff)', border: '1px solid var(--b1, #e8ecf4)', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>{title}</h2>
      {children}
    </div>
  );

  const field = (label: string, hint: string, children: React.ReactNode) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--t2, #334064)', marginBottom: 6 }}>{label}</label>
      {hint && <div style={{ fontSize: 12, color: 'var(--t3, #64748b)', marginBottom: 8 }}>{hint}</div>}
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
          borderColor: value === opt.value ? 'var(--violet, #6c35ff)' : 'var(--b1, #e8ecf4)',
          background: value === opt.value ? 'var(--s2, #f5f0ff)' : 'var(--s1, #fff)',
        }}>
          <input
            type="radio" name={name} value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value as T)}
            style={{ marginTop: 3, accentColor: 'var(--violet, #6c35ff)' }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1, #1a1a2e)' }}>{opt.label}</div>
            <div style={{ fontSize: 12, color: 'var(--t3, #64748b)', marginTop: 2 }}>{opt.description}</div>
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '32px 24px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href={`/dashboard/campaigns/${id}`} style={{ color: 'var(--t3, #94a3b8)', fontSize: 13, textDecoration: 'none' }}>
          ← Back to campaign
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--t1, #1a1a2e)', margin: '8px 0 0' }}>Campaign Settings</h1>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red, #dc2626)', fontSize: 13 }}>
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
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div
              onClick={() => setAcceptDonations(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 99, cursor: 'pointer',
                background: acceptDonations ? 'var(--violet, #6c35ff)' : 'var(--b1, #e2e8f0)',
                transition: 'background .2s', position: 'relative', flexShrink: 0,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3, transition: 'left .2s',
                left: acceptDonations ? 23 : 3,
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2, #334064)' }}>
              {acceptDonations ? 'Accepting donations' : 'Donations paused'}
            </span>
          </label>,
        )}

        <button
          onClick={saveCoreSettings}
          disabled={coreState === 'saving'}
          style={{
            background: coreState === 'saved' ? 'var(--green, #19b86a)' : 'var(--violet, #6c35ff)',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
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
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--b1, #e8ecf4)', fontSize: 14, color: 'var(--t1, #334064)', background: 'var(--s1, #fff)' }}
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
            background: launchState === 'saved' ? 'var(--green, #19b86a)' : 'var(--violet, #6c35ff)',
            color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}
        >
          {btnLabel(launchState)}
        </button>
      </>)}

      {/* Danger zone */}
      {section('Danger Zone', <>
        <p style={{ fontSize: 13, color: 'var(--t3, #64748b)', marginBottom: 16 }}>
          Deleting a campaign is permanent. Active campaigns must be paused or closed first.
        </p>
        <button
          onClick={deleteCampaign}
          style={{
            background: 'none', border: '1.5px solid var(--red, #ef4444)',
            color: 'var(--red, #ef4444)', borderRadius: 10,
            padding: '10px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}
        >
          Delete campaign
        </button>
      </>)}
    </div>
  );
}
