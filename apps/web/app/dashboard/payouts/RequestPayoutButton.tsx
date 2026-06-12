'use client';

import React, { useState } from 'react';
import { formatMoneyShort } from '@shared/currencies';

interface Campaign { id: string; title: string; raised_amount: number; currency?: string | null }

interface Props { campaigns: Campaign[] }

type Speed = 'standard' | 'same_day' | 'instant';

const SPEED_OPTS: { value: Speed; label: string; desc: string; fee: string }[] = [
  { value: 'standard', label: 'Standard',  desc: '3–5 business days', fee: 'Free' },
  { value: 'same_day', label: 'Same day',  desc: 'Within 24 hours',   fee: '0.5% fee' },
  { value: 'instant',  label: 'Instant',   desc: 'Within minutes',    fee: '1.5% fee' },
];

export default function RequestPayoutButton({ campaigns }: Props) {
  const [open, setOpen]           = useState(false);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [speed, setSpeed]         = useState<Speed>('standard');
  const [note, setNote]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ ok: boolean; message: string } | null>(null);

  const selected = campaigns.find(c => c.id === campaignId);
  const currency = selected?.currency ?? 'usd';
  const fmt = (cents: number) => formatMoneyShort(cents, currency);
  const speedFee = speed === 'same_day' ? 0.005 : speed === 'instant' ? 0.015 : 0;
  const estFee   = selected ? Math.round(selected.raised_amount * speedFee) : 0;
  const estNet   = selected ? selected.raised_amount - estFee : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, payoutSpeed: speed, note: note.trim() || undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `Payout of ${fmt(d.netCents)} initiated successfully.` });
        setTimeout(() => { setOpen(false); setResult(null); window.location.reload(); }, 2500);
      } else {
        setResult({ ok: false, message: d.error ?? 'Payout request failed.' });
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (campaigns.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: '#6c35ff', color: '#fff', border: 'none',
          borderRadius: 10, padding: '10px 20px', fontWeight: 800,
          fontSize: 14, cursor: 'pointer',
        }}
      >
        Request Payout
      </button>

      {open && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{
            background: 'var(--s1, #fff)', borderRadius: 20, padding: 32,
            width: '100%', maxWidth: 480,
            boxShadow: '0 24px 60px rgba(0,0,0,.2)',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 900, color: 'var(--t1, #1a1a2e)' }}>
              Request Payout
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Campaign selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--t2, #334064)', marginBottom: 6 }}>Campaign</label>
                <select
                  value={campaignId}
                  onChange={e => setCampaignId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--b1, #e8ecf4)', fontSize: 14, background: 'var(--s1, #fff)', color: 'var(--t1, #1a1a2e)' }}
                >
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.title} — {formatMoneyShort(c.raised_amount, c.currency ?? 'usd')}</option>
                  ))}
                </select>
              </div>

              {/* Speed selector */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--t2, #334064)', marginBottom: 8 }}>Payout speed</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SPEED_OPTS.map(opt => (
                    <label key={opt.value} style={{
                      display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px',
                      borderRadius: 10, cursor: 'pointer', border: '1.5px solid',
                      borderColor: speed === opt.value ? 'var(--violet, #6c35ff)' : 'var(--b1, #e8ecf4)',
                      background: speed === opt.value ? 'var(--s2, #f5f0ff)' : 'var(--s1, #fff)',
                    }}>
                      <input
                        type="radio" name="speed" value={opt.value}
                        checked={speed === opt.value}
                        onChange={() => setSpeed(opt.value)}
                        style={{ accentColor: 'var(--violet, #6c35ff)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1, #1a1a2e)' }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--t3, #64748b)' }}>{opt.desc}</div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: opt.fee === 'Free' ? '#19b86a' : '#f59e0b' }}>
                        {opt.fee}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {selected && (
                <div style={{ background: 'var(--s2, #f8fafc)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--t3, #64748b)' }}>Available balance</span>
                    <span style={{ fontWeight: 700, color: 'var(--t1)' }}>{fmt(selected.raised_amount)}</span>
                  </div>
                  {estFee > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--t3, #64748b)' }}>Speed fee</span>
                      <span style={{ fontWeight: 700, color: '#f59e0b' }}>−{fmt(estFee)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--b1, #e8ecf4)', paddingTop: 6, marginTop: 4 }}>
                    <span style={{ fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>You receive</span>
                    <span style={{ fontWeight: 900, color: '#19b86a', fontSize: 15 }}>{fmt(estNet)}</span>
                  </div>
                </div>
              )}

              {/* Note */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: 'var(--t2, #334064)', marginBottom: 6 }}>
                  Note <span style={{ fontWeight: 400, color: 'var(--t3, #94a3b8)' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Medical expenses, Month 2"
                  maxLength={500}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--b1, #e8ecf4)', fontSize: 14, boxSizing: 'border-box', background: 'var(--s1, #fff)', color: 'var(--t1)' }}
                />
              </div>

              {result && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600,
                  background: result.ok ? '#f0fdf4' : '#fef2f2',
                  color: result.ok ? '#15803d' : '#dc2626',
                  border: `1px solid ${result.ok ? '#86efac' : '#fecaca'}`,
                }}>
                  {result.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1.5px solid var(--b1, #e8ecf4)', background: 'var(--s1, #fff)', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'var(--t3, #64748b)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !campaignId}
                  style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: '#6c35ff', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Requesting…' : 'Request Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
