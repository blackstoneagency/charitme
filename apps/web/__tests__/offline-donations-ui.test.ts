import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

const UI = 'app/dashboard/campaigns/[id]/_components/RecordOfflineDonation.tsx';
const ROUTE = 'app/api/offline-donations/route.ts';

function tsxSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) out.push(readFileSync(p, 'utf8'));
    }
  };
  walk(join(WEB_ROOT, 'app'));
  walk(join(WEB_ROOT, 'components'));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// `/api/offline-donations` was complete — auth, ownership, zod validation, a
// durable rate limit — and **nothing in the product called it**. An organizer
// handed cash at an event had no way to get it into the campaign.
//
// The trap: the Ledger panel offers an "Offline donation received" item type,
// which writes `transparency_ledger_items` — a public note about money. It does
// NOT create a donation, so it never moves `raised_amount` or the backer count.
// Anyone using it would reasonably assume the total should have changed.
// ─────────────────────────────────────────────────────────────────────────────

describe('offline donations are reachable through the product', () => {
  it('some UI posts to the endpoint', () => {
    const callers = tsxSources().filter((s) => s.includes("'/api/offline-donations'"));
    expect(callers.length, 'the offline-donations endpoint has no UI caller').toBeGreaterThan(0);
  });

  it('it is rendered where the organizer manages supporters', () => {
    expect(read('app/dashboard/campaigns/[id]/_components/SupportersPanel.tsx'))
      .toContain('RecordOfflineDonation');
  });

  it('sends only the fields the endpoint validates', () => {
    const ui = read(UI);
    const route = read(ROUTE);
    for (const key of ['campaignId', 'amountCents', 'method']) {
      expect(ui, `UI never sends ${key}`).toContain(key);
      expect(route, `route no longer accepts ${key}`).toContain(key);
    }
  });

  it('offers exactly the payment methods the schema allows', () => {
    const route = read(ROUTE);
    const allowed = /method:\s*z\.enum\(\[([^\]]+)\]\)/.exec(route)?.[1] ?? '';
    const values = [...allowed.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(values.length).toBeGreaterThan(2);
    const ui = read(UI);
    for (const v of values) {
      expect(ui, `UI cannot select the '${v}' method the API accepts`).toContain(`'${v}'`);
    }
  });

  it('converts money to integer cents without floating-point drift', () => {
    // "12.34" must become 1234, not 1233.9999999999998.
    const ui = read(UI);
    expect(ui).toMatch(/Math\.round\(Number\([^)]*\) \* 100\)/);
    expect(Math.round(Number('12.34') * 100)).toBe(1234);
    expect(Math.round(Number('0.07') * 100)).toBe(7);
  });

  it('does not report success when the request failed', () => {
    const ui = read(UI);
    expect(ui).toMatch(/if \(!res\.ok\) throw/);
  });

  it('distinguishes itself from the ledger note that does not count', () => {
    // The whole point: the ledger item is a transparency note, this is the money.
    expect(read(UI)).toMatch(/counts toward|raise your campaign total/i);
  });
});
