import { describe, it, expect } from 'vitest';
import {
  splitEvenly,
  buildSplit,
  encodeSplit,
  decodeSplit,
  lineSessionId,
  MAX_PORTFOLIO_CAMPAIGNS,
  MIN_PORTFOLIO_SHARE_CENTS,
} from '../lib/portfolio-split';

// Money that does not reconcile is the failure this file exists to prevent. A
// rounding bug here does not throw — it transfers a cent the platform never
// collected, or keeps a cent a donor meant to give, and it shows up weeks later
// in reconciliation with no way to attribute it.

const ids = (n: number) => Array.from({ length: n }, (_, i) => `campaign-${i + 1}`);

describe('splitEvenly', () => {
  it('sums to the total EXACTLY, for every awkward combination', () => {
    // The property that matters, asserted broadly rather than on one example.
    for (let total = 100; total <= 100_000; total += 137) {
      for (let n = 1; n <= MAX_PORTFOLIO_CAMPAIGNS; n++) {
        const parts = splitEvenly(total, ids(n));
        const sum = parts.reduce((s, p) => s + p.amountCents, 0);
        expect(sum, `${total} across ${n}`).toBe(total);
      }
    }
  });

  it('divides $10 three ways as 334/333/333, not 333/333/333', () => {
    const parts = splitEvenly(1000, ids(3));
    expect(parts.map((p) => p.amountCents)).toEqual([334, 333, 333]);
  });

  it('keeps every part within one cent of every other', () => {
    for (let n = 2; n <= MAX_PORTFOLIO_CAMPAIGNS; n++) {
      const amounts = splitEvenly(9_999, ids(n)).map((p) => p.amountCents);
      expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
    }
  });

  it('returns integers only — never a fractional cent', () => {
    for (const part of splitEvenly(1000, ids(7))) {
      expect(Number.isInteger(part.amountCents)).toBe(true);
    }
  });

  it('handles a single campaign and an empty list', () => {
    expect(splitEvenly(500, ids(1))).toEqual([{ campaignId: 'campaign-1', amountCents: 500 }]);
    expect(splitEvenly(500, [])).toEqual([]);
  });
});

describe('buildSplit', () => {
  it('accepts an even split with no explicit parts', () => {
    const r = buildSplit(1000, ids(4));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parts.reduce((s, p) => s + p.amountCents, 0)).toBe(1000);
  });

  it('accepts custom amounts that reconcile', () => {
    const r = buildSplit(1000, ['a', 'b'], [
      { campaignId: 'a', amountCents: 700 },
      { campaignId: 'b', amountCents: 300 },
    ]);
    expect(r.ok).toBe(true);
  });

  it('REJECTS custom amounts that do not sum to the total', () => {
    // Under: the platform would keep money the donor meant to give.
    const under = buildSplit(1000, ['a', 'b'], [
      { campaignId: 'a', amountCents: 700 },
      { campaignId: 'b', amountCents: 200 },
    ]);
    expect(under.ok).toBe(false);
    if (!under.ok) expect(under.code).toBe('mismatch');

    // Over: the platform would transfer money it never collected.
    const over = buildSplit(1000, ['a', 'b'], [
      { campaignId: 'a', amountCents: 700 },
      { campaignId: 'b', amountCents: 400 },
    ]);
    expect(over.ok).toBe(false);
  });

  it('rejects an empty selection and one that is too large', () => {
    expect(buildSplit(1000, []).ok).toBe(false);
    expect(buildSplit(100_000, ids(MAX_PORTFOLIO_CAMPAIGNS + 1)).ok).toBe(false);
    expect(buildSplit(100_000, ids(MAX_PORTFOLIO_CAMPAIGNS)).ok).toBe(true);
  });

  it('rejects a duplicated campaign', () => {
    // A duplicate would be transferred to twice, and would collide on the
    // per-line idempotency key (session, campaign).
    const r = buildSplit(1000, ['a', 'a']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('duplicate');
  });

  it('rejects a share below the minimum', () => {
    const r = buildSplit(150, ['a', 'b']); // 75 each
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('share_too_small');
    expect(buildSplit(MIN_PORTFOLIO_SHARE_CENTS * 2, ['a', 'b']).ok).toBe(true);
  });

  it('rejects an amount for a campaign that was not chosen', () => {
    const r = buildSplit(1000, ['a', 'b'], [
      { campaignId: 'a', amountCents: 500 },
      { campaignId: 'zzz', amountCents: 500 },
    ]);
    expect(r.ok).toBe(false);
  });

  it('rejects fractional cents supplied by a caller', () => {
    const r = buildSplit(1000, ['a', 'b'], [
      { campaignId: 'a', amountCents: 500.5 },
      { campaignId: 'b', amountCents: 499.5 },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe('metadata encoding', () => {
  it('round-trips exactly', () => {
    const parts = splitEvenly(1000, ['aaa', 'bbb', 'ccc']);
    expect(decodeSplit(encodeSplit(parts))).toEqual(parts);
  });

  it('stays under the Stripe 500-character metadata limit at maximum size', () => {
    // This is why MAX_PORTFOLIO_CAMPAIGNS is 8. Exceeding it makes Stripe reject
    // the session at checkout, in front of a donor.
    const uuids = Array.from({ length: MAX_PORTFOLIO_CAMPAIGNS }, (_, i) =>
      `123e4567-e89b-12d3-a456-4266141740${String(i).padStart(2, '0')}`,
    );
    const encoded = encodeSplit(splitEvenly(99_999_999, uuids));
    expect(encoded.length).toBeLessThan(500);
  });

  it('survives a uuid containing no colon and skips malformed chunks', () => {
    // decodeSplit runs inside the Stripe webhook, where throwing makes Stripe
    // retry forever — a bad chunk must be dropped, not fatal.
    expect(decodeSplit('a:100,GARBAGE,b:200')).toEqual([
      { campaignId: 'a', amountCents: 100 },
      { campaignId: 'b', amountCents: 200 },
    ]);
    expect(decodeSplit('a:0')).toEqual([]);
    expect(decodeSplit('a:-5')).toEqual([]);
    expect(decodeSplit('')).toEqual([]);
    expect(decodeSplit(null)).toEqual([]);
    expect(decodeSplit(undefined)).toEqual([]);
  });

  it('parses the LAST colon, so an id containing one is not truncated', () => {
    expect(decodeSplit('weird:id:500')).toEqual([{ campaignId: 'weird:id', amountCents: 500 }]);
  });
});

describe('lineSessionId', () => {
  it('is unique per campaign within one checkout session', () => {
    const a = lineSessionId('cs_test_123', 'camp-a');
    const b = lineSessionId('cs_test_123', 'camp-b');
    expect(a).not.toBe(b);
  });

  it('is stable, so a Stripe retry lands on the same key', () => {
    expect(lineSessionId('cs_1', 'c1')).toBe(lineSessionId('cs_1', 'c1'));
  });
});
