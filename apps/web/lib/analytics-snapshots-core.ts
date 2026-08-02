/**
 * Daily analytics snapshots — the table that gives a campaign a PAST.
 *
 * Every number the dashboard shows is the value right now: `raised_amount`,
 * `backer_count`, a percentage of goal. Nothing on the site could answer "how
 * did last week compare to this one?", because the shape of the curve — the only
 * thing a fundraiser can actually act on — was never recorded. `analytics_snapshots`
 * was built for that and had neither a reader nor a writer.
 *
 * Pure module: the metrics shape, the deltas between two days, and the series a
 * chart needs. No Supabase, no `server-only`, no clock beyond what is passed in.
 */

/** What one day's snapshot records. */
export type SnapshotMetrics = Readonly<{
  raisedCents: number;
  backerCount: number;
  goalCents: number;
  donationCount: number;
}>;

export const EMPTY_METRICS: SnapshotMetrics = {
  raisedCents: 0,
  backerCount: 0,
  goalCents: 0,
  donationCount: 0,
};

/**
 * Narrow arbitrary jsonb into metrics.
 *
 * The column is `jsonb DEFAULT '{}'`, so a row written by an older version of
 * this code is missing fields. Falling back PER FIELD rather than rejecting the
 * whole object means an old snapshot still plots instead of leaving a hole in
 * the middle of the series — a gap a reader would have to guess how to bridge.
 */
export function parseMetrics(value: unknown): SnapshotMetrics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_METRICS;
  const raw = value as Record<string, unknown>;
  const num = (key: keyof SnapshotMetrics): number => {
    const v = raw[key];
    // Negative money is not a smaller number here, it is a corrupt row. Clamped
    // rather than plotted, which would draw a dip that never happened.
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  };
  return {
    raisedCents: num('raisedCents'),
    backerCount: num('backerCount'),
    goalCents: num('goalCents'),
    donationCount: num('donationCount'),
  };
}

/** A stored row as the app reads it. */
export type SnapshotRow = {
  snapshot_date: string;
  metrics: unknown;
};

export type SnapshotPoint = {
  /** `YYYY-MM-DD`. */
  date: string;
  metrics: SnapshotMetrics;
};

/**
 * Turn stored rows into an oldest-first series.
 *
 * Duplicate dates are collapsed to the LAST row seen for that date. The writer
 * is idempotent per day, but a table that predates it — or two cron runs racing
 * — can hold two rows for one date, and plotting both would put two points at
 * the same x.
 */
export function toSeries(rows: readonly SnapshotRow[]): SnapshotPoint[] {
  const byDate = new Map<string, SnapshotMetrics>();
  for (const row of rows) {
    if (typeof row.snapshot_date !== 'string' || row.snapshot_date.length === 0) continue;
    byDate.set(row.snapshot_date, parseMetrics(row.metrics));
  }
  return [...byDate.entries()]
    .map(([date, metrics]) => ({ date, metrics }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export type SnapshotDelta = {
  raisedCents: number;
  backerCount: number;
  donationCount: number;
  /** Days actually spanned by the two endpoints. */
  days: number;
};

/**
 * Change between the first and last point of a series.
 *
 * Returns `null` for fewer than two points. A single snapshot is a value, not a
 * change — reporting `+0` from one day of data would claim the campaign was flat
 * when what actually happened is that nothing has been measured yet.
 */
export function seriesDelta(series: readonly SnapshotPoint[]): SnapshotDelta | null {
  if (series.length < 2) return null;
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const start = Date.parse(`${first.date}T00:00:00Z`);
  const end = Date.parse(`${last.date}T00:00:00Z`);
  const days = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.round((end - start) / 86_400_000))
    : 0;
  return {
    raisedCents: last.metrics.raisedCents - first.metrics.raisedCents,
    backerCount: last.metrics.backerCount - first.metrics.backerCount,
    donationCount: last.metrics.donationCount - first.metrics.donationCount,
    days,
  };
}

/**
 * Money raised on each day, derived from consecutive totals.
 *
 * The stored metric is a cumulative total, so a per-day figure is a difference.
 * The first point has no predecessor and is therefore **omitted**, not reported
 * as its full total — that would draw a huge spike on day one representing every
 * donation the campaign ever took.
 *
 * A negative step (a refund, or a corrected total) is kept as-is. Clamping it to
 * zero would silently hide money going back out.
 */
export function dailyRaised(series: readonly SnapshotPoint[]): { date: string; cents: number }[] {
  const out: { date: string; cents: number }[] = [];
  for (let i = 1; i < series.length; i += 1) {
    out.push({
      date: series[i]!.date,
      cents: series[i]!.metrics.raisedCents - series[i - 1]!.metrics.raisedCents,
    });
  }
  return out;
}

/** `YYYY-MM-DD` in UTC — the same calendar the column's `CURRENT_DATE` default uses. */
export function snapshotDate(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Percent of goal, or `null` when there is no goal to measure against.
 *
 * `null` rather than 0: a campaign with no goal is not at 0% of it.
 */
export function percentOfGoal(metrics: SnapshotMetrics): number | null {
  if (metrics.goalCents <= 0) return null;
  return Math.round((metrics.raisedCents / metrics.goalCents) * 100);
}
