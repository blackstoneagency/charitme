'use client';

import React, { useEffect, useState } from 'react';
import { percentOfGoal, type SnapshotPoint } from '../../../../../lib/analytics-snapshots-core';

type Delta = { raisedCents: number; backerCount: number; donationCount: number; days: number } | null;
type History = { series: SnapshotPoint[]; delta: Delta };

/**
 * The recorded history from `analytics_snapshots`.
 *
 * ⚠️ **What this shows that the panel above cannot.** The daily-donations chart
 * beside it is derived live from the `donations` table, and for "money in per
 * day" that is strictly better data — it needs no snapshot to exist. This section
 * deliberately does NOT duplicate it.
 *
 * What a live query genuinely cannot reconstruct is **what the goal was on a
 * given day**: `campaigns.goal_amount` holds one value, the current one, so a
 * campaign that raised its goal mid-run looks — retroactively — as though it had
 * always had the higher one, and last month's "80% of goal" silently becomes
 * "40%". Only a snapshot taken that day remembers otherwise. That is the curve
 * plotted here, and it is the reason the table earns its keep rather than being
 * a cache of something already known.
 */
export default function RecordedHistory({ campaignId }: { campaignId: string }) {
  // `undefined` = still loading, `null` = the read FAILED. Neither is "nothing
  // has been recorded", which is a claim about the campaign.
  const [history, setHistory] = useState<History | null | undefined>(undefined);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/snapshots?days=90`);
        if (!res.ok) { if (active) setHistory(null); return; }
        const body = await res.json();
        if (active) setHistory({ series: body.series ?? [], delta: body.delta ?? null });
      } catch {
        if (active) setHistory(null);
      }
    })();
    return () => { active = false; };
  }, [campaignId]);

  if (history === undefined) return null;

  if (history === null) {
    return (
      <div style={card}>
        <h2 style={heading}>Progress toward goal</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--red-text)' }}>
          The recorded history could not be loaded. That is a read failure, not an
          empty history.
        </p>
      </div>
    );
  }

  // Fewer than two days is not a curve. Saying so beats drawing a single dot and
  // calling it a trend.
  if (history.series.length < 2) {
    return (
      <div style={card}>
        <h2 style={heading}>Progress toward goal</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t3)' }}>
          {history.series.length === 0
            ? 'Nothing recorded yet — this chart fills in from the first daily snapshot onward.'
            : 'One day recorded so far. A second is needed before there is a trend to draw.'}
        </p>
      </div>
    );
  }

  const points = history.series.map((p) => ({ date: p.date, pct: percentOfGoal(p.metrics) }));
  // A day with no goal has no percentage — it is left out of the curve rather
  // than plotted as 0%, which would draw a crash to the axis that never happened.
  const plottable = points.filter((p): p is { date: string; pct: number } => p.pct !== null);
  const max = Math.max(100, ...plottable.map((p) => p.pct));

  return (
    <div style={card}>
      <h2 style={heading}>Progress toward goal</h2>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--t3)' }}>
        Measured against the goal as it stood on each day, which is the one thing
        a live query cannot work out after the fact.
      </p>

      {plottable.length < 2 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--t3)' }}>
          No goal was set on the recorded days, so there is no percentage to plot.
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, minWidth: 0, overflow: 'hidden' }}>
          {plottable.map((p) => (
            <div
              key={p.date}
              title={`${p.date}: ${p.pct}% of goal`}
              style={{
                flex: 1, minWidth: 2,
                height: `${Math.max(2, (p.pct / max) * 100)}%`,
                background: p.pct >= 100 ? 'var(--green)' : 'var(--violet)',
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      )}

      {history.delta && (
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--t3)' }}>
          Over the last {history.delta.days} recorded {history.delta.days === 1 ? 'day' : 'days'}:{' '}
          <strong style={{ color: 'var(--t1)' }}>
            {history.delta.raisedCents >= 0 ? '+' : '−'}$
            {Math.abs(history.delta.raisedCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </strong>
          {' · '}
          {history.delta.backerCount >= 0 ? '+' : '−'}{Math.abs(history.delta.backerCount)} donors
        </p>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 14,
  padding: '20px 22px', marginBottom: 20, minWidth: 0,
};
const heading: React.CSSProperties = {
  margin: '0 0 6px', fontSize: 15, fontWeight: 650, color: 'var(--t1)',
};
