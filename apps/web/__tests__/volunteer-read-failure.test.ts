import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const loader = read('lib/volunteers-server.ts');
const page = read('app/volunteer/(list)/page.tsx');

describe('a failed volunteer read is not reported as "none exist"', () => {
  it('the loader returns null on error, not an empty array', () => {
    // It returned [] for both, so a database outage rendered "No volunteer
    // opportunities listed yet" — a confident, false statement from a page
    // that could not read anything. Same failure class as `?? 0` on a count;
    // the empty array just hid it better.
    expect(loader).toContain('Promise<VolunteerOpportunity[] | null>');
    expect(loader).toContain('if (error) return null;');
    expect(loader).not.toContain('if (error) return [];');
  });

  it('the page distinguishes the two and renders an em dash for a failure', () => {
    expect(page).toContain('const readFailed = opportunityResult === null;');
    expect(page).toContain("readFailed ? '—'");
  });

  it('still renders a real 0 when there genuinely are none', () => {
    // The em dash is for an unreadable figure only. A measured zero is a
    // measurement and must show as 0.
    expect(page).toContain('n.toLocaleString()');
  });

  it('never coerces the failed read into a count', () => {
    expect(page).not.toMatch(/opportunities\.length \?\? 0/);
  });
});
