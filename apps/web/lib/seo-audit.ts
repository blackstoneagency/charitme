import 'server-only';

export type TimestampedRow = { updated_at: string | null };

const STALE_DAYS = 90;

export function isStaleSeoContent(updatedAt: string | null, now = Date.now()): boolean {
  if (!updatedAt) return false;
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) && now - timestamp > STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function countStaleSeoContent(rows: TimestampedRow[], now = Date.now()): number {
  return rows.filter((row) => isStaleSeoContent(row.updated_at, now)).length;
}
