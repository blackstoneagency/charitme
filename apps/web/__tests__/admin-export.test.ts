import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
/**
 * Comments are blanked before matching. These assertions say "the code no longer
 * does X", and the code documents what X was — without this, the explanation of a
 * fixed bug reads as the bug itself.
 */
const read = (p: string) =>
  readFileSync(join(WEB_ROOT, p), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

const CLIENT = 'app/admin/donations/_components/DonationsClient.tsx';
const ROUTE = 'app/api/admin/reports/export/route.ts';

// ─────────────────────────────────────────────────────────────────────────────
// The admin donations export was broken four ways at once:
//
//  1. The POST body was `{ format, type: 'donations' }`, but the endpoint requires
//     `reportId` and 400s without it. The response was piped straight into a Blob
//     download, so Export produced a file named `donations.csv` containing
//     `{"error":"reportId is required"}`.
//  2. A second Export button used `window.open()` on a GET URL against a route
//     that only implements POST — a tab showing 405, not a download.
//  3. "Data Type" and "Date Range" were unbound <select>s. Choosing "Refunded Only
//     / Last 30 days" silently exported completed donations for all time.
//  4. "Format" offered Excel and PDF; the endpoint only ever emits CSV, so picking
//     PDF downloaded a CSV named ".pdf".
// ─────────────────────────────────────────────────────────────────────────────

describe('the export request is one the endpoint accepts', () => {
  const client = read(CLIENT);
  const route = read(ROUTE);

  it('sends the reportId the route requires', () => {
    expect(route).toContain("error: 'reportId is required'");
    expect(client).toMatch(/reportId:/);
    // The old shape sent a `type` field the route never reads.
    expect(client).not.toMatch(/type:\s*'donations'/);
  });

  it('never downloads a failed response as a file', () => {
    expect(client).toMatch(/if \(!res\.ok\)/);
    // The download must happen after the ok-check, not before it.
    const okCheck = client.indexOf('if (!res.ok)');
    const blob = client.indexOf('await res.blob()');
    expect(okCheck).toBeGreaterThan(-1);
    expect(blob).toBeGreaterThan(okCheck);
  });

  it('no longer opens a GET URL against a POST-only route', () => {
    expect(route).not.toContain('export async function GET');
    expect(client).not.toContain("window.open('/api/admin/reports/export");
  });
});

describe('the export honours what the operator selected', () => {
  const client = read(CLIENT);
  const route = read(ROUTE);

  it('binds every filter select to state', () => {
    for (const binding of ['setExportDataType', 'setExportRange', 'setExportFormat']) {
      expect(client, `${binding} is not wired`).toContain(binding);
    }
  });

  it('sends the chosen status and date range', () => {
    expect(client).toMatch(/payload\.status\s*=/);
    expect(client).toMatch(/payload\.since\s*=/);
  });

  it('the route actually applies them to the query', () => {
    expect(route).toMatch(/if \(statusFilter\) donationQuery = donationQuery\.eq\('status', statusFilter\)/);
    expect(route).toMatch(/if \(sinceFilter\) donationQuery = donationQuery\.gte\('created_at', sinceFilter\)/);
  });

  it('allow-lists the status rather than passing it through', () => {
    // A caller must not be able to inject an arbitrary filter value.
    expect(route).toContain('DONATION_STATUSES');
    expect(route).toMatch(/DONATION_STATUSES\.has\(status\)/);
  });

  it('"All Donations" means no status filter, not "completed"', () => {
    expect(route).toMatch(/status === 'all' \? null/);
  });

  it('only offers formats the server can produce', () => {
    // The route emits text/csv unconditionally.
    expect(route).toContain("'Content-Type': 'text/csv'");
    expect(client).not.toMatch(/<option value="pdf">/);
    expect(client).not.toMatch(/<option value="excel">/);
  });
});
