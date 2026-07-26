import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }));

const { pct, summarizeAudit } = await import('../lib/marketing-command-center');

// ─────────────────────────────────────────────────────────────────────────────
// The Command Center is an executive dashboard, so its numbers get quoted. These
// pin the two rules that keep it honest: never invent a percentage without a
// baseline, and never show a raw enum where a human label was promised.
// ─────────────────────────────────────────────────────────────────────────────

describe('pct — week-over-week change', () => {
  it('returns null when the prior period was zero', () => {
    // Growth from zero is infinite; there is no honest percentage to print, and
    // the card renders "no prior-week baseline" on null.
    expect(pct(50, 0)).toBeNull();
  });

  it('still returns null when both periods are zero', () => {
    // The tempting-but-wrong answer here is 0% — "no change" implies we measured
    // something. We did not.
    expect(pct(0, 0)).toBeNull();
  });

  it('computes growth', () => {
    expect(pct(150, 100)).toBeCloseTo(50);
  });

  it('computes decline as a negative number', () => {
    // The card takes Math.abs() and picks the arrow from the sign, so the sign
    // here is what decides ▲ vs ▼.
    expect(pct(75, 100)).toBeCloseTo(-25);
  });

  it('reports no change as exactly 0, not null', () => {
    // Distinct from the no-baseline case above: 0 here is a real measurement.
    expect(pct(100, 100)).toBe(0);
  });

  it('handles a drop to zero', () => {
    expect(pct(0, 80)).toBeCloseTo(-100);
  });
});

describe('summarizeAudit', () => {
  it('prefers an explicit title', () => {
    expect(summarizeAudit('goal_created', { title: 'Grow recurring donors' })).toBe('Grow recurring donors');
  });

  it('falls back to name when there is no title', () => {
    expect(summarizeAudit('segment_created', { name: 'Lapsed donors' })).toBe('Lapsed donors');
  });

  it('falls back to a status transition', () => {
    expect(summarizeAudit('goal_updated', { status: 'active' })).toBe('→ active');
  });

  it('humanises the action name when the detail is empty', () => {
    expect(summarizeAudit('campaign_plan_generated', {})).toBe('campaign plan generated');
  });

  it('humanises the action name when the detail is null', () => {
    // Audit rows predating a detail column, or written by a path that omits it.
    expect(summarizeAudit('goal_archived', null)).toBe('goal archived');
  });

  it('ignores non-string title/name/status rather than rendering "[object Object]"', () => {
    expect(summarizeAudit('goal_updated', { title: { nested: true }, name: 42 })).toBe('goal updated');
  });
});
