import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY_METRICS,
  parseMetrics,
  toSeries,
  seriesDelta,
  dailyRaised,
  snapshotDate,
  percentOfGoal,
  type SnapshotPoint,
} from '../lib/analytics-snapshots-core';

const point = (date: string, raisedCents: number, over = {}): SnapshotPoint => ({
  date,
  metrics: { ...EMPTY_METRICS, raisedCents, ...over },
});

describe('the schema this module is written against', () => {
  it('stores metrics as jsonb with a {} default, which is why parsing is per-field', () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    const match = /CREATE TABLE public\.analytics_snapshots \(([\s\S]*?)\n\);/.exec(schema);
    expect(match, 'analytics_snapshots moved or was renamed').toBeTruthy();
    expect(match![1]).toContain("metrics jsonb DEFAULT '{}'::jsonb NOT NULL");
    expect(match![1]).toContain('snapshot_date');
  });

  it('has a SELECT-only policy, so the writer cannot use the session client', () => {
    // `analytics_owner_private` is FOR SELECT. There is no INSERT policy, so a
    // write through the anon/session client would be refused by RLS — the cron
    // writer must go through the service role. If an INSERT policy is ever added
    // this test fails and that decision gets revisited deliberately.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    expect(schema).toContain('CREATE POLICY analytics_owner_private ON public.analytics_snapshots FOR SELECT');
    expect(schema).not.toMatch(/CREATE POLICY \w+ ON public\.analytics_snapshots FOR INSERT/);
  });
});

describe('parseMetrics', () => {
  it('falls back per FIELD, so an old row still plots', () => {
    // Rejecting the whole object would leave a hole in the middle of the series,
    // and a reader would have to guess how to bridge it.
    const partial = parseMetrics({ raisedCents: 5000 });
    expect(partial.raisedCents).toBe(5000);
    expect(partial.backerCount).toBe(0);
  });

  it('survives arbitrary jsonb', () => {
    expect(parseMetrics(null)).toEqual(EMPTY_METRICS);
    expect(parseMetrics('nope')).toEqual(EMPTY_METRICS);
    expect(parseMetrics([1, 2])).toEqual(EMPTY_METRICS);
    expect(parseMetrics({ raisedCents: 'lots' })).toEqual(EMPTY_METRICS);
  });

  it('clamps a negative stored total rather than plotting a dip that never happened', () => {
    expect(parseMetrics({ raisedCents: -900 }).raisedCents).toBe(0);
    expect(parseMetrics({ backerCount: Number.NaN }).backerCount).toBe(0);
  });
});

describe('toSeries', () => {
  it('sorts oldest-first regardless of the order rows arrive in', () => {
    const series = toSeries([
      { snapshot_date: '2026-08-02', metrics: { raisedCents: 300 } },
      { snapshot_date: '2026-07-31', metrics: { raisedCents: 100 } },
      { snapshot_date: '2026-08-01', metrics: { raisedCents: 200 } },
    ]);
    expect(series.map((p) => p.date)).toEqual(['2026-07-31', '2026-08-01', '2026-08-02']);
  });

  it('collapses duplicate dates so a chart never gets two points at one x', () => {
    // The writer is idempotent per day, but a table predating it — or two cron
    // runs racing — can hold two rows for one date.
    const series = toSeries([
      { snapshot_date: '2026-08-01', metrics: { raisedCents: 100 } },
      { snapshot_date: '2026-08-01', metrics: { raisedCents: 180 } },
    ]);
    expect(series).toHaveLength(1);
    expect(series[0]!.metrics.raisedCents).toBe(180);
  });

  it('drops rows with no usable date rather than inventing one', () => {
    expect(toSeries([{ snapshot_date: '', metrics: {} }])).toEqual([]);
  });

  it('returns an empty series for no rows', () => {
    expect(toSeries([])).toEqual([]);
  });
});

describe('seriesDelta', () => {
  it('reports the change across the whole window', () => {
    const delta = seriesDelta([
      point('2026-07-26', 10_000, { backerCount: 3, donationCount: 3 }),
      point('2026-08-02', 42_000, { backerCount: 11, donationCount: 14 }),
    ]);
    expect(delta).toEqual({ raisedCents: 32_000, backerCount: 8, donationCount: 11, days: 7 });
  });

  it('is null for a single point — one snapshot is a value, not a change', () => {
    // Reporting +0 would claim the campaign was flat, when what actually
    // happened is that nothing has been measured yet.
    expect(seriesDelta([point('2026-08-02', 500)])).toBeNull();
    expect(seriesDelta([])).toBeNull();
  });

  it('reports a decrease as a decrease', () => {
    const delta = seriesDelta([point('2026-08-01', 5_000), point('2026-08-02', 4_000)]);
    expect(delta!.raisedCents).toBe(-1_000);
  });
});

describe('dailyRaised', () => {
  it('derives per-day money from consecutive cumulative totals', () => {
    expect(dailyRaised([
      point('2026-08-01', 1_000),
      point('2026-08-02', 2_500),
      point('2026-08-03', 2_500),
    ])).toEqual([
      { date: '2026-08-02', cents: 1_500 },
      { date: '2026-08-03', cents: 0 },
    ]);
  });

  it('omits the first point rather than reporting its full total as one day', () => {
    // The stored metric is cumulative. Treating point one as a day would draw a
    // spike representing every donation the campaign ever took.
    const out = dailyRaised([point('2026-08-01', 90_000), point('2026-08-02', 90_500)]);
    expect(out.map((d) => d.date)).toEqual(['2026-08-02']);
    expect(out[0]!.cents).toBe(500);
  });

  it('keeps a negative step, because money really can go back out', () => {
    const out = dailyRaised([point('2026-08-01', 5_000), point('2026-08-02', 4_200)]);
    expect(out[0]!.cents).toBe(-800);
  });

  it('is empty for fewer than two points', () => {
    expect(dailyRaised([point('2026-08-01', 10)])).toEqual([]);
    expect(dailyRaised([])).toEqual([]);
  });
});

describe('snapshotDate', () => {
  it('uses the UTC calendar the column default uses', () => {
    // A local-time date would disagree with CURRENT_DATE on the server for part
    // of every day, and produce two rows for what is one day in the database.
    expect(snapshotDate(Date.parse('2026-08-02T23:30:00Z'))).toBe('2026-08-02');
    expect(snapshotDate(Date.parse('2026-08-03T00:30:00Z'))).toBe('2026-08-03');
  });
});

describe('percentOfGoal', () => {
  it('is null with no goal, not 0%', () => {
    // A campaign with no goal is not at 0% of it.
    expect(percentOfGoal({ ...EMPTY_METRICS, raisedCents: 500 })).toBeNull();
  });

  it('rounds against the goal when there is one', () => {
    expect(percentOfGoal({ ...EMPTY_METRICS, raisedCents: 500, goalCents: 2_000 })).toBe(25);
  });
});
