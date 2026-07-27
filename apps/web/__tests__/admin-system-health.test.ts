import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const read = (p: string) => strip(readFileSync(join(WEB_ROOT, p), 'utf8'));

const PAGE = 'app/admin/page.tsx';
const CLIENT = 'app/admin/_components/AdminDashboardClient.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// The admin System Health panel asserted green without measuring.
//
//  • Platform, Storage and Email Service were hardcoded `'Operational'` — four of
//    six rows claimed health that was never checked.
//  • Payment Gateway's only signal is `webhook_events` error count, read as
//    `count ?? 0`. `count` is null whenever the query errors, so a database
//    problem rendered "0 errors" → **Operational** — a false all-clear on exactly
//    the screen an operator opens during an incident.
//
// Same direction as the risk-flag defect: zero is the favourable answer, so it
// needs proof.
// ─────────────────────────────────────────────────────────────────────────────

describe('system health never claims a status it did not measure', () => {
  const page = read(PAGE);

  it('does not hardcode Operational for unmeasured services', () => {
    for (const service of ['Platform', 'Storage', 'Email Service']) {
      expect(
        page,
        `${service} still asserts a status nothing checks`,
      ).not.toMatch(new RegExp(`name: '${service}', status: 'Operational'`));
    }
  });

  it('keeps Database as Operational — the one safe inference', () => {
    // The page's own queries just returned, so the database is reachable.
    expect(page).toMatch(/name: 'Database', status: 'Operational'/);
  });

  it('reports Unknown when the webhook signal could not be read', () => {
    expect(page).toMatch(/webhookErrorsUnknown/);
    expect(page).toMatch(/webhookErrorsUnknown \? 'Unknown'/);
    // The old shape could only ever say Degraded or Operational.
    expect(page).not.toMatch(/status: webhookErrors > 5 \? 'Degraded' : 'Operational'/);
  });

  it('derives "unknown" from the error field, not just a falsy count', () => {
    expect(page).toMatch(/Boolean\(webhookErrorsResult\.error\) \|\| webhookErrorsResult\.count == null/);
  });

  it('shows an em dash rather than 0 integrations when unreadable', () => {
    expect(page).toMatch(/Integrations \(—\)/);
  });
});

describe('the client can render the Unknown state', () => {
  const client = read(CLIENT);

  it('accepts Unknown in the status union', () => {
    expect(client).toMatch(/'Operational' \| 'Degraded' \| 'Down' \| 'Unknown'/);
  });

  it('gives it its own colour, not the green of Operational', () => {
    // Two call sites: the status dot and the label.
    const greys = client.match(/'Unknown' \? '#(94a3b8|64748b)'/g) ?? [];
    expect(greys.length).toBeGreaterThanOrEqual(2);
  });
});
