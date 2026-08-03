'use client';

import React, { useEffect, useState } from 'react';

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}

type FlaggedCampaign = {
  campaignId: string;
  campaignTitle: string;
  flags: { code: string; label: string; severity: string }[];
};

type ScanResult = {
  scanned: number;
  newFlagsCount: number;
  flaggedCampaigns: FlaggedCampaign[];
  message: string;
  model: string;
};

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
};

export default function RunFraudScanButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  useEscape(() => setOpen(false));

  async function handleClick() {
    setOpen(true);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/ai/fraud-monitor', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not run fraud scan.'); return; }
      setResult(json as ScanResult);
      if ((json as ScanResult).newFlagsCount > 0) {
        setTimeout(() => window.location.reload(), 1800);
      }
    } catch {
      setError('Could not run fraud scan. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        ✨ Run Fraud Scan
      </button>

      {open && (
        // Backdrop dismissal is supplementary; Escape and the close button remain available.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div role="dialog" aria-modal="true" aria-label="AI Fraud and Misuse Monitor" style={{ background: 'var(--s1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--t1)' }}>✨ AI Fraud & Misuse Monitor</h2>
              <button type="button" onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>

            {loading && <p style={{ fontSize: 13, color: 'var(--t3)' }}>Scanning active campaigns for risk signals…</p>}
            {error && <div style={{ padding: '10px 14px', background: 'var(--tint-rose)', border: '1px solid #fecdd3', borderRadius: 8, color: 'var(--red-text)', fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>}

            {result && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
                <div style={{ display: 'flex', minWidth: 0, gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120, background: 'var(--s2)', border: '1px solid #f0f4f8', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--t1)' }}>{result.scanned}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>Campaigns scanned</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 120, background: 'var(--s2)', border: '1px solid #f0f4f8', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: result.newFlagsCount > 0 ? 'var(--red-text)' : 'var(--green-text)' }}>{result.newFlagsCount}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--t3)', marginTop: 2 }}>New flags raised</div>
                  </div>
                </div>

                <div style={{ fontSize: 13.5, color: 'var(--t1)', background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '12px 14px', lineHeight: 1.6 }}>
                  {result.message}
                </div>

                {result.flaggedCampaigns.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t3)', marginBottom: 6 }}>Newly flagged campaigns</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                      {result.flaggedCampaigns.map((c) => (
                        <div key={c.campaignId} style={{ border: '1px solid #f0f4f8', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>{c.campaignTitle}</div>
                          <div style={{ display: 'flex', minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
                            {c.flags.map((f) => (
                              <span key={f.code} style={{ background: (SEV_COLOR[f.severity] ?? '#6b7280') + '18', color: SEV_COLOR[f.severity] ?? '#6b7280', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>
                                {f.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 10 }}>Refreshing the page to show new flags…</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
