import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  PROCESSING_FEE_PERCENT,
  PROCESSING_FEE_FIXED_CENTS,
  PLATFORM_FEE_PERCENT,
  SUGGESTED_SUPPORT_PERCENT,
} from '@shared/fees';
import {
  PROCESSING_FEE_COPY,
  PROCESSING_PERCENT_COPY,
  PROCESSING_FIXED_COPY,
  PLATFORM_FEE_COPY,
  SUGGESTED_SUPPORT_COPY,
} from '../lib/fee-copy';

// ─────────────────────────────────────────────────────────────────────────────
// The Terms of Service — a contract — stated the suggested donor support as 8%
// while the real default is 15%. Nine other public pages spelled out the
// processing fee as a literal "2.9% + $0.30".
//
// Nothing could catch that. A wrong number in a paragraph is valid TSX that
// renders perfectly, and a page contradicting another page reads exactly as
// confident as the one that is right. Only comparing the prose against the
// constants finds it, so this compares.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = join(__dirname, '..');
const ROOTS = ['app', 'components', 'lib'];
const SELF = join('lib', 'fee-copy.ts');

function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(full)) out.push(full);
    }
  };
  for (const root of ROOTS) walk(join(WEB, root));
  return out;
}

/** Strip comments so a doc comment quoting a figure is not a finding. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('the fee prose is derived from the shared constants', () => {
  it('formats each figure from its constant', () => {
    expect(PROCESSING_PERCENT_COPY).toBe(`${PROCESSING_FEE_PERCENT}%`);
    expect(PROCESSING_FIXED_COPY).toBe(`$${(PROCESSING_FEE_FIXED_CENTS / 100).toFixed(2)}`);
    expect(PROCESSING_FEE_COPY).toBe(`${PROCESSING_FEE_PERCENT}% + $0.30`);
    expect(PLATFORM_FEE_COPY).toBe(`${PLATFORM_FEE_PERCENT}%`);
    expect(SUGGESTED_SUPPORT_COPY).toBe(`${SUGGESTED_SUPPORT_PERCENT}%`);
  });

  it('renders cents as two decimal places, not "$0.3"', () => {
    expect(PROCESSING_FIXED_COPY).toBe('$0.30');
  });

  it('scans a real tree', () => {
    // Without this, a wrong root would make the sweeps below vacuous.
    expect(sources().length).toBeGreaterThan(200);
  });

  it('no file spells out the processing fee by hand', () => {
    const literal = new RegExp(
      `${PROCESSING_FEE_PERCENT}\\s*%\\s*\\+\\s*\\$\\s*${(PROCESSING_FEE_FIXED_CENTS / 100).toFixed(2)}`,
    );
    const offenders = sources()
      .filter((f) => relative(WEB, f) !== SELF)
      .filter((f) => literal.test(code(readFileSync(f, 'utf8'))))
      .map((f) => relative(WEB, f));
    expect(
      offenders,
      `hardcoded processing fee — import PROCESSING_FEE_COPY instead:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no page states a donor-support default other than the real one', () => {
    // This is the Terms of Service defect, generalized: a percentage sitting
    // next to the words "tip"/"support" and "default"/"suggested" must be the
    // constant. 8% is a real rung on the ladder, which is precisely why the
    // wrong number looked plausible for as long as it did.
    const near = /(?:default|suggested)[^.]{0,60}?(\d{1,2})\s*%|(\d{1,2})\s*%[^.]{0,40}?(?:default|suggested)/gi;
    const offenders: string[] = [];
    for (const file of sources()) {
      if (relative(WEB, file) === SELF) continue;
      const text = code(readFileSync(file, 'utf8'));
      if (!/\b(tip|donor support|support tip)\b/i.test(text)) continue;
      for (const m of text.matchAll(near)) {
        const pct = Number(m[1] ?? m[2]);
        if (Number.isFinite(pct) && pct !== SUGGESTED_SUPPORT_PERCENT && pct !== 0) {
          offenders.push(`${relative(WEB, file)}: "${m[0].trim()}"`);
        }
      }
    }
    expect(
      offenders,
      `a default/suggested support percentage that is not ${SUGGESTED_SUPPORT_PERCENT}%:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the sweep can actually fail', () => {
    // A detector that has never fired proves nothing. Feed it the shape it
    // hunts for and confirm it matches.
    const literal = new RegExp(
      `${PROCESSING_FEE_PERCENT}\\s*%\\s*\\+\\s*\\$\\s*${(PROCESSING_FEE_FIXED_CENTS / 100).toFixed(2)}`,
    );
    expect(literal.test('Stripe charges 2.9% + $0.30 per transaction')).toBe(true);
    expect(literal.test('Stripe charges the standard card rate')).toBe(false);
  });
});
