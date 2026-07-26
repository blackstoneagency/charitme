import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = join(__dirname, '..');

function readPage(route: string): string {
  return readFileSync(join(WEB_ROOT, 'app', 'dashboard', route, 'page.tsx'), 'utf8');
}

describe('dashboard data trust', () => {
  const metricPages = ['donations', 'analytics', 'donor', 'payouts'];

  it.each(metricPages)('%s distinguishes unavailable data from a real empty result', (route) => {
    const source = readPage(route);

    expect(source).toContain('boundedQuery(');
    expect(source).toContain('loadFailed');
    expect(source).toContain('DataUnavailableAlert');
    expect(source).toMatch(/value:\s*loadFailed\s*\?\s*['"]—['"]/);
    expect(source).toMatch(/change:\s*loadFailed\s*\?\s*['"]unavailable['"]/);
  });

  it.each(['recurring', 'refund'])(
    '%s blocks false empty states when its core read is unavailable',
    (route) => {
      const source = readPage(route);

      expect(source).toContain('boundedQuery(');
      expect(source).toContain('DataUnavailableAlert');
      expect(source).toMatch(/error|Error/);
    },
  );

  it('does not generate an AI growth plan from failed Supabase reads', () => {
    const source = readPage('ai-growth-plan');

    expect(source).toContain('boundedQuery(');
    expect(source).toContain('if (loadFailed)');
    expect(source).toContain("We couldn't build a trustworthy growth plan");
    expect(source).toContain('before acting on recommendations');
  });

  it('does not label identified donors anonymous when profile enrichment fails', () => {
    const source = readPage('donations');

    expect(source).toContain("profileMap.get(d.donor_id) ?? 'Donor'");
    expect(source).not.toContain("profileMap.get(d.donor_id) ?? 'Anonymous'");
  });

  it('does not render real empty-state copy after a core load failure', () => {
    expect(readPage('donations')).toContain('!loadFailed && filtered.length === 0');
    expect(readPage('donor')).toContain('!loadFailed && filtered.length === 0');
    expect(readPage('payouts')).toContain('!loadFailed && filtered.length === 0');
    expect(readPage('recurring')).toContain('!loadFailed && recurringList.length === 0');
    expect(readPage('analytics')).toContain('campaignsUnavailable ? (');
  });

  it('does not enable refund submission when eligibility reads fail', () => {
    const source = readPage('refund');

    expect(source).toContain('if (donationsError || !rawDonations)');
    expect(source).toContain('if (refundsError || !existingRefunds)');
    expect(source).toContain('No refund request has been submitted.');
  });
});
