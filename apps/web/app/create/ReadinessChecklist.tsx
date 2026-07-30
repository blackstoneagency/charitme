'use client';

import React from 'react';
import type { ReadinessResult, ReadinessItem, ReadinessStep } from '../../lib/campaign-readiness';

// Publish-readiness checklist shown on the review step. Each unfinished item is a
// button that jumps to the exact wizard step to fix it. Pure scoring lives in
// lib/campaign-readiness.ts. Themed + mobile-first.
export default function ReadinessChecklist({
  readiness,
  onGoToStep,
}: {
  readiness: ReadinessResult;
  onGoToStep: (step: ReadinessStep) => void;
}) {
  const { items, score, readyToPublish } = readiness;
  const barColor = readyToPublish ? 'var(--green, #059669)' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ padding: '18px 18px 14px', borderRadius: 16, border: '1.5px solid var(--b1, #e8ecf4)', background: 'var(--s1, #fff)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1, #1a1a2e)' }}>Publish readiness</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: barColor }}>{score}%</span>
      </div>

      <div style={{ height: 8, borderRadius: 999, background: 'var(--s3, #eef2f7)', overflow: 'hidden', margin: '8px 0 4px' }}>
        <div style={{ height: '100%', width: `${score}%`, background: barColor, transition: 'width .25s' }} />
      </div>

      <p style={{ margin: '2px 0 12px', fontSize: 13, color: readyToPublish ? 'var(--green-dark, #047857)' : 'var(--t3, #64748b)', fontWeight: readyToPublish ? 700 : 500 }}>
        {readyToPublish
          ? '✓ Ready to publish. Finish the recommended items below for a stronger campaign.'
          : 'Complete the required items (marked ★) before publishing.'}
      </p>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item: ReadinessItem) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onGoToStep(item.step)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${item.done ? 'transparent' : 'var(--b1, #e8ecf4)'}`,
                background: item.done ? 'transparent' : 'var(--s2, #f8fafc)',
                fontFamily: 'inherit',
              }}
            >
              <span style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: item.done ? 'var(--green, #059669)' : 'var(--s3, #e5e9f0)',
                color: item.done ? '#fff' : 'var(--t3, #94a3b8)', fontSize: 12, fontWeight: 900,
              }}>
                {item.done ? '✓' : (item.required ? '★' : '')}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1, #1a1a2e)' }}>
                  {item.label}{item.required && !item.done ? ' (required)' : ''}
                </span>
                {!item.done && item.hint && (
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--t3)', marginTop: 1 }}>{item.hint}</span>
                )}
              </span>
              {!item.done && (
                <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--violet, #6c35ff)' }}>Fix →</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
