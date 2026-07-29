import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isPlaceholderUrl, realUrlOrNull } from '../lib/placeholder-url';

const WEB_ROOT = join(__dirname, '..');

/** Every `.from('<table>')` call site in application code. */
function callSites(table: string): string[] {
  const hits: string[] = [];
  const pattern = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`);
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      if (pattern.test(readFileSync(p, 'utf8'))) hits.push(p.replace(WEB_ROOT + '/', ''));
    }
  };
  for (const d of ['app', 'lib', 'components']) {
    try { walk(join(WEB_ROOT, d)); } catch { /* optional */ }
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// `trust_scores` holds 500 rows that NOTHING reads, and that is correct.
//
// Measured in production 2026-07-27: every row's `computed_at` is around
// 2026-04-27 — roughly three months stale — with `signals: []` and
// `model: 'deterministic'`. The live trust score is computed per request by
// lib/trust-signals.ts + lib/ai-platform.ts, which read the campaign's current
// state and the open risk-flag count.
//
// So wiring this table into the read path would be a REGRESSION, not a
// completion: it would publish three-month-old trust numbers on public campaign
// pages as if they were current. That is the same "stale data presented as fact"
// shape as the count fail-opens fixed earlier this session, and it is the
// tempting move for anyone who sees an orphaned table and wants to "finish
// wiring it up".
//
// This guard is deliberately reversible: if the table is ever made authoritative
// (a job that recomputes it, plus a freshness check at read time), delete this
// test along with the assumption it protects.
// ─────────────────────────────────────────────────────────────────────────────
describe('trust_scores stays out of the read path while it is stale', () => {
  it('is not read by any application code', () => {
    const sites = callSites('trust_scores');
    expect(
      sites,
      'trust_scores is ~3 months stale in production (computed_at ≈ 2026-04-27, signals: []).\n' +
        'The live score is computed per request by lib/trust-signals.ts. Reading this table\n' +
        'would publish stale trust numbers on public campaign pages.\n' +
        'If you have made it authoritative — a recompute job AND a freshness check at read\n' +
        'time — delete this test deliberately, not incidentally.',
    ).toEqual([]);
  });

  it('the live computation still exists, so this is a real alternative', () => {
    // Non-vacuity: the guard only makes sense while a live path exists.
    expect(callSites('risk_flags').length).toBeGreaterThan(0);
    expect(readFileSync(join(WEB_ROOT, 'lib/trust-signals.ts'), 'utf8')).toContain('risk_flag_count');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `grant_documents` holds 240 rows whose `file_url` is
// `https://example.org/docs/N.pdf` — an RFC 2606 reserved domain, i.e. a
// placeholder that resolves to nothing. Surfacing the table as-is would render
// 240 dead download links on a page about grant paperwork.
//
// lib/placeholder-url.ts already exists for exactly this and is used by the
// events and grants pages. Any future grant-document UI must route through it.
// ─────────────────────────────────────────────────────────────────────────────
describe('placeholder file URLs have a detector ready for use', () => {
  it('the helper recognises the domain the seed data actually uses', () => {
    expect(isPlaceholderUrl('https://example.org/docs/1.pdf')).toBe(true);
    expect(realUrlOrNull('https://example.org/docs/1.pdf')).toBeNull();
  });

  it('and does not reject a genuine document URL', () => {
    expect(realUrlOrNull('https://files.charitme.com/docs/1.pdf')).toBe('https://files.charitme.com/docs/1.pdf');
  });
});
