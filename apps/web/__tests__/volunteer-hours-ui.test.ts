import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');
const read = (p: string) =>
  readFileSync(join(WEB_ROOT, p), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

const API = 'app/api/volunteers/hours/route.ts';
const UI = 'app/dashboard/volunteer/VolunteerHoursClient.tsx';

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
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAR-1102 shipped the schema, the domain rules, and check-in / check-out /
// verify as API routes — but nothing could LIST hours. A volunteer could not see
// what they had logged, and an organizer had no queue, so the verify endpoint had
// no caller anywhere in the product: logged time could never be certified.
// ─────────────────────────────────────────────────────────────────────────────

describe('logged hours are reachable through the product', () => {
  it('the verify endpoint has a UI caller', () => {
    const callers = tsxSources().filter((s) => /hours\/\$\{[^}]+\}\/verify/.test(s));
    expect(callers.length, 'nothing calls the hours verify endpoint').toBeGreaterThan(0);
  });

  it('check-out is reachable too', () => {
    const callers = tsxSources().filter((s) => /hours\/\$\{[^}]+\}\/check-out/.test(s));
    expect(callers.length, 'nothing calls the hours check-out endpoint').toBeGreaterThan(0);
  });

  it('both scopes are rendered on the volunteer dashboard', () => {
    const page = read('app/dashboard/volunteer/page.tsx');
    expect(page).toContain('VolunteerHoursClient');
    expect(page).toMatch(/scope="mine"/);
    expect(page).toMatch(/scope="to-verify"/);
  });
});

describe('the hours endpoint is scoped and honest', () => {
  const src = read(API);

  it('rejects anonymous callers', () => {
    expect(src).toContain("{ error: 'Unauthorized' }");
  });

  it('"mine" returns only the caller\'s own rows', () => {
    expect(src).toContain("eq('volunteer_user_id', user.id)");
  });

  it('"to-verify" is gated on owning the opportunity', () => {
    // Ownership is resolved first, then hours are filtered by those ids — a wrong
    // filter cannot leak another organizer's volunteers.
    expect(src).toContain("eq('created_by', user.id)");
    expect(src).toMatch(/in\('opportunity_id', opportunityIds\)/);
  });

  it('excludes soft-deleted rows', () => {
    expect(src.match(/is\('deleted_at', null\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('reports a failed read as an error, not as zero hours', () => {
    // Hours are work someone did; rendering 0 because a query failed is a claim
    // we cannot make.
    expect(src.match(/INTERNAL_ERROR/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('bounds the query and batches name lookups', () => {
    expect(src).toMatch(/\.limit\(\d+\)/);
    expect(src).toContain('Promise.all');
  });
});

describe('verified hours are never conflated with unverified ones', () => {
  const src = read(UI);

  it('derives totals from totalHours() rather than summing in the API', () => {
    expect(read(API)).toContain('totalHours(');
  });

  it('shows the three states separately', () => {
    expect(src).toContain('totals.verified');
    expect(src).toContain('totals.pending');
    expect(src).toContain('totals.rejected');
  });

  it('says plainly that only verified hours may go to an employer', () => {
    expect(src).toMatch(/reported to an employer/i);
  });

  it('never renders a single combined total', () => {
    expect(src).not.toMatch(/totals\.verified\s*\+\s*totals\.pending/);
  });

  it('tells a volunteer that checking out is not certification', () => {
    expect(src).toMatch(/organizer verifies it separately/i);
  });

  it('degrades honestly when the read fails', () => {
    expect(src).toContain('role="alert"');
    expect(src).toMatch(/No logged hours have been lost/);
  });
});
