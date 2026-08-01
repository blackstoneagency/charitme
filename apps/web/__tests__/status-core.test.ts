import { describe, it, expect } from 'vitest';
import {
  classify,
  overallStatus,
  overallHeadline,
  notConfigured,
  SLOW_MS,
  type Subsystem,
} from '../lib/status-core';

// A status page's only real requirement is that it can say NO. One that reports
// green because the string is hardcoded is worse than none: it turns an outage
// into a contradiction the visitor cannot resolve, and it looks identical to a
// working page on the day it matters. These assert the degrade paths.

const sub = (state: Subsystem['state']): Subsystem => ({
  key: 'k',
  label: 'L',
  description: 'd',
  state,
});

describe('classify', () => {
  it('reports a failed probe as down, with the caller message', () => {
    const r = classify({ ok: false, ms: 12 }, 'Data is unreachable.');
    expect(r.state).toBe('down');
    expect(r.detail).toBe('Data is unreachable.');
  });

  it('reports a slow but successful probe as degraded', () => {
    const r = classify({ ok: true, ms: SLOW_MS }, 'x');
    expect(r.state).toBe('degraded');
    expect(r.detail).toMatch(/slow/i);
  });

  it('reports a fast success as operational with NO invented detail', () => {
    const r = classify({ ok: true, ms: 5 }, 'x');
    expect(r.state).toBe('operational');
    expect(r.detail).toBeUndefined();
  });

  it('puts the slow boundary at SLOW_MS, not above it', () => {
    expect(classify({ ok: true, ms: SLOW_MS - 1 }, 'x').state).toBe('operational');
    expect(classify({ ok: true, ms: SLOW_MS }, 'x').state).toBe('degraded');
  });
});

describe('overallStatus', () => {
  it('is operational only when everything is', () => {
    expect(overallStatus([sub('operational'), sub('operational')])).toBe('operational');
  });

  it('takes the WORST subsystem, never an average', () => {
    // Averaging is how three broken things out of ten become "mostly
    // operational" — the headline has to reflect the worst.
    expect(overallStatus([sub('operational'), sub('degraded')])).toBe('degraded');
    expect(overallStatus([sub('operational'), sub('down')])).toBe('down');
    expect(overallStatus([sub('degraded'), sub('down'), sub('operational')])).toBe('down');
  });

  it('one failure among many still degrades the headline', () => {
    const many = [...Array(9)].map(() => sub('operational'));
    expect(overallStatus([...many, sub('down')])).toBe('down');
  });

  it('an empty list is operational rather than throwing', () => {
    expect(overallStatus([])).toBe('operational');
  });
});

describe('overallHeadline', () => {
  it('never says "all systems operational" unless it is true', () => {
    expect(overallHeadline('operational')).toMatch(/all systems operational/i);
    expect(overallHeadline('degraded')).not.toMatch(/all systems operational/i);
    expect(overallHeadline('down')).not.toMatch(/all systems operational/i);
  });
});

describe('notConfigured', () => {
  it('is degraded, never operational', () => {
    // Email that cannot send is not working. Marking it green because nothing
    // errored is exactly the lie this module exists to prevent.
    const s = notConfigured('email', 'Email', 'receipts', 'The email provider');
    expect(s.state).toBe('degraded');
    expect(s.detail).toContain('not configured');
  });

  it('degrades the overall headline when present', () => {
    const s = notConfigured('email', 'Email', 'receipts', 'The email provider');
    expect(overallStatus([sub('operational'), s])).toBe('degraded');
  });
});
