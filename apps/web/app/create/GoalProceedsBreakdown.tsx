'use client';

import React from 'react';
import { goalProceeds } from '../../lib/goal-proceeds';
import { formatMoneyShort } from '@shared/currencies';

// Shown on the goal step once a goal is entered. Educates the organizer on
// CharitMe's 0% platform fee and the only real deduction (payment processing).
// Pure math lives in lib/goal-proceeds.ts. Themed + mobile-first.
export default function GoalProceedsBreakdown({ goalCents, currency = 'USD' }: { goalCents: number; currency?: string }) {
  if (!goalCents || goalCents < 100) return null;
  const p = goalProceeds(goalCents);
  const fmt = (cents: number): string => formatMoneyShort(cents, currency);

  return (
    <div
      style={{
        marginTop: 18,
        padding: '16px 18px 14px',
        borderRadius: 16,
        border: '1.5px solid var(--b1, #e8ecf4)',
        background: 'var(--s1, #fff)',
      }}
    >
      <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1, #1a1a2e)' }}>
          Where your {fmt(p.goalCents)} goes
        </span>
      </div>

      <Row label="Your goal" value={fmt(p.goalCents)} />
      <Row
        label="CharitMe platform fee"
        sub="We take 0% — always"
        value={fmt(0)}
        valueColor="var(--green-dark, #047857)"
      />
      <Row
        label="Payment processing (est.)"
        sub={`${p.processingRateLabel} per donation — donors can cover this so you keep 100%`}
        value={`–${fmt(p.estProcessingCents)}`}
        valueColor="var(--t3, #64748b)"
      />

      <div
        style={{
          marginTop: 10,
          paddingTop: 12,
          borderTop: '1.5px dashed var(--b1, #e8ecf4)',
          display: 'flex', flexWrap: 'wrap', minWidth: 0,
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--t1, #1a1a2e)' }}>You keep</span>
        <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--green, #059669)' }}>
          ~{fmt(p.estNetCents)}
        </span>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
        You keep 100% of every donation — CharitMe never takes a cut. The only deduction is the
        payment processor&apos;s fee, and most donors choose to cover it at checkout. This estimate
        assumes one lump donation; real totals vary as gifts arrive.
      </p>
    </div>
  );
}

function Row({
  label,
  sub,
  value,
  valueColor = 'var(--t1, #1a1a2e)',
}: {
  label: string;
  sub?: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '5px 0' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--t1, #1a1a2e)' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginTop: 1, lineHeight: 1.4 }}>{sub}</span>}
      </span>
      <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 800, color: valueColor }}>{value}</span>
    </div>
  );
}
