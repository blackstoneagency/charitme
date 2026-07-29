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
    // Two call sites: the status dot (a background, still a literal grey) and the
    // label (now var(--t3), which is grey in BOTH themes and AA on the surfaces it
    // sits on). The assertion is the INTENT — Unknown reads grey, never the green
    // of Operational — not a specific hex, so the contrast pass that tokenised the
    // label does not have to be reverted to keep the guarantee.
    const greys = client.match(/'Unknown' \? '(?:#(?:94a3b8|64748b)|var\(--t3\))'/g) ?? [];
    expect(greys.length).toBeGreaterThanOrEqual(2);

    // And it must never share Operational's green token or hex.
    const operationalGreen = /'Operational' \? '(?:#19b86a|var\(--green-text\))'/;
    expect(client).toMatch(operationalGreen);
    expect(client).not.toMatch(/'Unknown' \? '(?:#19b86a|var\(--green-text\))'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The support queue had the same shape. `count ?? 0` and `data ?? []` rendered
// **"Urgent: 0"** and an empty case list when the reads failed — telling a support
// admin nothing needs attention at the exact moment the database could not answer.
// ─────────────────────────────────────────────────────────────────────────────
describe('the support queue cannot report a false all-clear', () => {
  const page = read('app/admin/support/page.tsx');

  it('derives unknown from the error field for both counts', () => {
    expect(page).toMatch(/Boolean\(urgentResult\.error\) \|\| urgentResult\.count == null/);
    expect(page).toMatch(/Boolean\(resolvedResult\.error\) \|\| resolvedResult\.count == null/);
  });

  it('treats a failed case-list read as failure, not an empty queue', () => {
    expect(page).toMatch(/Boolean\(openResult\.error\) \|\| openResult\.data == null/);
    expect(page).toMatch(/Boolean\(inProgResult\.error\) \|\| inProgResult\.data == null/);
  });

  it('renders unknown counts as an em dash rather than 0', () => {
    expect(page).toMatch(/show\(urgentUnknown, urgent\)/);
    expect(page).toMatch(/show\(openFailed, open\.length\)/);
  });

  it('warns the operator not to read the queue as clear', () => {
    expect(page).toContain('role="alert"');
    expect(page).toMatch(/not an empty queue/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The notification badge had the same shape with a twist: its two failure modes
// pointed in OPPOSITE directions. `unreplied = total - replied` with `?? 0` on
// both sides meant a failed *replies* read counted every donor message as
// unreplied (inflating the badge), while a failed *totals* read collapsed it to 0
// (hiding it). Neither number is worth showing.
// ─────────────────────────────────────────────────────────────────────────────
describe('the notification count does not invent a number', () => {
  const route = read('app/api/notifications/count/route.ts');

  it('no longer subtracts two possibly-failed counts', () => {
    expect(route).not.toMatch(/\(totalResult\.count \?\? 0\) - \(repliedResult\.count \?\? 0\)/);
  });

  it('requires both halves before computing unreplied', () => {
    expect(route).toMatch(/if \(totalCount == null \|\| repliedCount == null\)/);
  });

  it('treats an errored read as unknown, not as zero', () => {
    expect(route).toMatch(/totalResult\.error \? null : totalResult\.count/);
    expect(route).toMatch(/repliedResult\.error \? null : repliedResult\.count/);
  });

  it('tells the caller the number is partial', () => {
    // "You have nothing" and "we could not check" are different facts.
    expect(route).toMatch(/partial/);
    expect(route).toMatch(/messages: unrepliedMessages, partial/);
  });
});
