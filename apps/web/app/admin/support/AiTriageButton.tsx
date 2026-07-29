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

interface Props { caseId: string; subject: string }

type Category =
  | 'payout_delay'
  | 'refund_dispute'
  | 'fraud_concern'
  | 'account_access'
  | 'campaign_management'
  | 'technical_bug'
  | 'billing_question'
  | 'general_inquiry';

type TriageResult = {
  category: Category;
  categoryLabel: string;
  suggestedAction: string;
  draftResponse: string;
  model: string;
};

const CATEGORY_COLORS: Record<Category, string> = {
  payout_delay: '#f97316',
  refund_dispute: '#ef4444',
  fraud_concern: '#dc2626',
  account_access: '#6c35ff',
  campaign_management: '#3b82f6',
  technical_bug: '#0891b2',
  billing_question: '#16a34a',
  general_inquiry: '#6b7280',
};

export default function AiTriageButton({ caseId, subject }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);
  const [copied, setCopied] = useState(false);
  useEscape(() => setOpen(false));

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setOpen(true);
    if (result || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/complaint-resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not generate AI triage.'); return; }
      setResult(json as TriageResult);
    } catch {
      setError('Could not generate AI triage. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.draftResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => void handleClick(e)}
        style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6c35ff,#4d1ee0)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        ✨ AI Triage
      </button>

      {open && (
        // Backdrop dismissal is supplementary; Escape and the close button remain available.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div role="dialog" aria-modal="true" aria-label="AI Complaint Resolver" style={{ background: 'var(--s1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--t1)' }}>✨ AI Complaint Resolver</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--t3)', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subject}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: 'var(--t3)' }}>✕</button>
            </div>

            {loading && <p style={{ fontSize: 13, color: 'var(--t3)' }}>Analyzing case…</p>}
            {error && <div style={{ padding: '10px 14px', background: 'var(--tint-rose)', border: '1px solid #fecdd3', borderRadius: 8, color: 'var(--red-text)', fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>}

            {result && (
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ background: (CATEGORY_COLORS[result.category] ?? '#6b7280') + '18', color: CATEGORY_COLORS[result.category] ?? '#6b7280', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                    {result.categoryLabel}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t3)', marginBottom: 6 }}>Suggested action</div>
                  <div style={{ fontSize: 13.5, color: 'var(--t1)', background: 'var(--s2)', border: '1px solid #f0f4f8', borderRadius: 8, padding: '10px 14px', lineHeight: 1.5 }}>
                    {result.suggestedAction}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t3)' }}>Draft response</div>
                    <button type="button" onClick={() => void handleCopy()} style={{ border: '1px solid #e8ecf4', background: 'var(--s1)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--brand-text)' }}>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div style={{ fontSize: 13.5, color: '#334064', background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '12px 14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {result.draftResponse}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  This draft has been saved as an internal note on the case.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
