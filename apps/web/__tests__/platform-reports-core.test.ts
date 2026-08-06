import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  REPORT_KINDS,
  REPORT_KIND_LABEL,
  isReportKind,
  formatBytes,
  isDownloadable,
  groupByKind,
  periodOf,
  type PlatformReport,
} from '../lib/platform-reports-core';

const report = (over: Partial<PlatformReport> = {}): PlatformReport => ({
  id: 'r1', title: 'Impact Report', kind: 'impact', period_label: '2024',
  summary: null, file_path: 'impact-2024.pdf', byte_size: 4_500_000,
  published_at: '2024-04-01T00:00:00.000Z', ...over,
});

describe('the migration this reads is written and matches', () => {
  const sql = (() => {
    const dir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
    const file = readdirSync(dir).find((f) => f.includes('platform_reports'));
    expect(file, 'the platform_reports migration is missing').toBeTruthy();
    return readFileSync(join(dir, file!), 'utf8');
  })();

  it('creates the table with the columns the reader selects', () => {
    expect(sql).toContain('create table if not exists public.platform_reports');
    for (const col of ['title', 'kind', 'period_label', 'summary', 'file_path', 'byte_size', 'published', 'published_at', 'sort_order', 'deleted_at']) {
      expect(sql, `${col} must exist for the reader`).toContain(col);
    }
  });

  it('allows exactly the kinds this module knows', () => {
    const match = /kind in \(([^)]*)\)/.exec(sql);
    expect(match, 'the kind CHECK moved').toBeTruthy();
    const allowed = [...match![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(allowed).toEqual([...REPORT_KINDS].sort());
  });

  it('refuses a published report with no file, so a Download button cannot be dead', () => {
    expect(sql).toContain('platform_reports_published_needs_file');
  });

  it('has a rollback that does NOT drop the storage bucket', () => {
    // Dropping it would delete the organisation's own published PDFs, which are
    // not reconstructible from this schema.
    const dir = join(__dirname, '..', '..', '..', 'supabase', 'rollbacks');
    const file = readdirSync(dir).find((f) => f.includes('platform_reports'));
    expect(file, 'the rollback is missing').toBeTruthy();
    const rollback = readFileSync(join(dir, file!), 'utf8');
    expect(rollback).toContain('drop table if exists public.platform_reports');
    expect(rollback).not.toMatch(/delete\s+from\s+storage\.buckets/i);
    expect(rollback).not.toMatch(/drop\s+.*bucket/i);
  });
});

describe('the reader tolerates the table not existing', () => {
  it('treats 42P01 as "none published" rather than an error', () => {
    // The migration is applied by the owner, so every environment that has not
    // run it yet answers 42P01. Treating that as a failure would put a red error
    // box on a public page for a feature that is simply not switched on.
    const src = readFileSync(join(__dirname, '..', 'lib', 'platform-reports-server.ts'), 'utf8');
    expect(src).toContain("error.code === '42P01'");
    expect(src).toMatch(/42P01'\) return \[\]/);
  });

  it('still returns null for any OTHER error', () => {
    const src = readFileSync(join(__dirname, '..', 'lib', 'platform-reports-server.ts'), 'utf8');
    expect(src).toContain('return null');
  });
});

describe('formatBytes', () => {
  it('is null when the size is unknown, not "0 MB"', () => {
    // A row can be created before its file is uploaded. "0 MB" beside a Download
    // link reads as a broken file rather than a missing measurement.
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(undefined)).toBeNull();
    expect(formatBytes(0)).toBeNull();
    expect(formatBytes(-1)).toBeNull();
    expect(formatBytes(Number.NaN)).toBeNull();
  });

  it('scales through B, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(4_500_000)).toBe('4.3 MB');
    expect(formatBytes(52_428_800)).toBe('50 MB');
  });
});

describe('isDownloadable', () => {
  it('needs a real path', () => {
    expect(isDownloadable({ file_path: 'a.pdf' })).toBe(true);
    expect(isDownloadable({ file_path: null })).toBe(false);
    expect(isDownloadable({ file_path: '   ' })).toBe(false);
  });
});

describe('groupByKind', () => {
  it('keeps the tab order from the design and drops empty groups', () => {
    const groups = groupByKind([
      report({ id: 'a', kind: 'annual' }),
      report({ id: 'i', kind: 'impact' }),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['impact', 'annual']);
  });

  it('ignores a kind the CHECK would not allow', () => {
    expect(groupByKind([report({ kind: 'nonsense' })])).toEqual([]);
  });

  it('is empty for no reports', () => {
    expect(groupByKind([])).toEqual([]);
  });
});

describe('periodOf', () => {
  it('prefers the publisher’s own wording', () => {
    // A financial year rarely matches the upload date, and the report's cover is
    // the authority on what it covers.
    expect(periodOf({ period_label: 'FY2023–24', published_at: '2025-01-01T00:00:00Z' })).toBe('FY2023–24');
  });

  it('falls back to the published year when no label was given', () => {
    expect(periodOf({ period_label: '', published_at: '2024-06-01T00:00:00Z' })).toBe('2024');
  });

  it('is empty rather than a guess when there is neither', () => {
    expect(periodOf({ period_label: '', published_at: null })).toBe('');
  });
});

describe('kind vocabulary', () => {
  it('accepts only real kinds and names every one', () => {
    expect(isReportKind('impact')).toBe(true);
    expect(isReportKind('newsletter')).toBe(false);
    for (const kind of REPORT_KINDS) expect(REPORT_KIND_LABEL[kind].length).toBeGreaterThan(0);
  });
});
