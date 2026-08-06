/**
 * Downloadable platform reports — pure display rules.
 *
 * Backs the report cards on `/reports`: "2024 Impact Report · PDF · 4.3 MB".
 *
 * ⚠️ **The table may not exist yet.** `20260826000000_platform_reports.sql` is
 * written but is applied by the owner, not by this sandbox. The server reader
 * treats PostgREST's `42P01` (undefined relation) as "no reports published"
 * rather than as an error, so this section is silent before the migration lands
 * and lights up the moment it does — the same pattern `cause-landing.ts` uses.
 */

export const REPORT_KINDS = ['impact', 'financial', 'annual'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === 'string' && (REPORT_KINDS as readonly string[]).includes(value);
}

export const REPORT_KIND_LABEL: Readonly<Record<ReportKind, string>> = {
  impact: 'Impact report',
  financial: 'Financial report',
  annual: 'Annual report',
};

export type PlatformReport = {
  id: string;
  title: string;
  kind: string;
  period_label: string;
  summary: string | null;
  file_path: string | null;
  byte_size: number | null;
  published_at: string | null;
};

/**
 * Human file size, or `null` when it is not known.
 *
 * `null` rather than "0 MB": a row may be created before its file is uploaded,
 * and "0 MB" beside a Download link reads as a broken file rather than as a
 * missing measurement.
 */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/**
 * Is this row actually downloadable?
 *
 * The database enforces the same rule (`platform_reports_published_needs_file`),
 * but a reader must not depend on a constraint added by a migration that may not
 * have run everywhere. A card with no file renders as text, never as a Download
 * button that 404s.
 */
export function isDownloadable(report: Pick<PlatformReport, 'file_path'>): boolean {
  return typeof report.file_path === 'string' && report.file_path.trim().length > 0;
}

/** Reports grouped by kind, in the order the tabs appear. */
export function groupByKind(reports: readonly PlatformReport[]): { kind: ReportKind; reports: PlatformReport[] }[] {
  return REPORT_KINDS
    .map((kind) => ({ kind, reports: reports.filter((r) => r.kind === kind) }))
    .filter((group) => group.reports.length > 0);
}

/**
 * Year label for a card, preferring what the report itself says.
 *
 * `period_label` is the publisher's own wording ("FY2023–24") and beats anything
 * derived from `published_at`, because a report's cover is the authority on what
 * period it covers — a financial year rarely matches the upload date.
 */
export function periodOf(report: Pick<PlatformReport, 'period_label' | 'published_at'>): string {
  const label = report.period_label?.trim();
  if (label) return label;
  if (!report.published_at) return '';
  const year = new Date(report.published_at).getUTCFullYear();
  return Number.isFinite(year) ? String(year) : '';
}
