import { describe, expect, it } from 'vitest';
import { toCsv } from '../lib/csv';
import { exportableHours, totalHours } from '../lib/volunteer-shifts-core';

// ─────────────────────────────────────────────────────────────────────────────
// The corporate export is the end of the chain: this file is what an employer
// receives. Two things must hold no matter what else changes —
//   1. unverified time never appears in it
//   2. a volunteer-supplied name cannot execute as a spreadsheet formula
// This pins the composition of the two helpers the route uses, which is where a
// regression would actually land (either one alone is already tested).
// ─────────────────────────────────────────────────────────────────────────────

const HEADERS = ['date', 'volunteer_name', 'volunteer_email', 'opportunity_id', 'hours'];

function buildCsv(
  rows: Parameters<typeof exportableHours>[0],
  names: Record<string, { full_name: string | null; email: string | null }>,
) {
  const eligible = exportableHours(rows);
  return toCsv(
    eligible.map((r) => ({
      date: r.date ?? '',
      volunteer_name: names[r.volunteerUserId]?.full_name ?? '',
      volunteer_email: names[r.volunteerUserId]?.email ?? '',
      opportunity_id: r.opportunityId,
      hours: r.hours.toFixed(2),
    })),
    HEADERS,
  );
}

const row = (over: Partial<Parameters<typeof exportableHours>[0][number]> = {}) => ({
  volunteer_user_id: 'u1',
  opportunity_id: 'o1',
  checked_in_at: '2026-08-01T09:00:00Z',
  hours: 4,
  status: 'verified' as const,
  ...over,
});

describe('corporate hours export', () => {
  it('includes verified hours', () => {
    const csv = buildCsv([row()], { u1: { full_name: 'Ada Lovelace', email: 'ada@example.com' } });
    expect(csv).toContain('2026-08-01,Ada Lovelace,ada@example.com,o1,4.00');
  });

  it('never includes pending or rejected time', () => {
    const csv = buildCsv(
      [row({ status: 'pending', hours: 99 }), row({ status: 'rejected', hours: 99 })],
      { u1: { full_name: 'Ada', email: 'ada@example.com' } },
    );
    // Header row only.
    expect(csv.split('\n')).toHaveLength(1);
    expect(csv).not.toContain('99');
  });

  it('neutralises a formula in a volunteer-supplied name', () => {
    // A volunteer can set their own display name. Without escaping, Excel would
    // execute this on open — from a file an employer was told to trust.
    const csv = buildCsv([row()], {
      u1: { full_name: '=HYPERLINK("http://evil","click")', email: 'x@example.com' },
    });
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });

  it('keeps hours numeric rather than quoting them into text', () => {
    const csv = buildCsv([row({ hours: 2.5 })], { u1: { full_name: 'Ada', email: 'a@b.c' } });
    expect(csv).toContain(',2.50');
    expect(csv).not.toContain('"2.50"');
  });

  it('escapes a comma in a name without breaking the column count', () => {
    const csv = buildCsv([row()], { u1: { full_name: 'Lovelace, Ada', email: 'a@b.c' } });
    const line = csv.split('\n')[1];
    expect(line).toContain('"Lovelace, Ada"');
    // 5 columns even though the name contains a delimiter.
    expect(line.match(/(?:^|,)(?:"[^"]*"|[^,]*)/g)).toHaveLength(HEADERS.length);
  });

  it('reports the verified total separately from what was logged', () => {
    const totals = totalHours([
      { hours: 4, status: 'verified' },
      { hours: 6, status: 'pending' },
    ]);
    // The header the route sets must not imply the pending time counts.
    expect(totals.verified).toBe(4);
  });
});
