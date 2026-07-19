// ─────────────────────────────────────────────────────────────────────────────
// CSV helpers with formula-injection protection.
//
// User-controlled values (donor names, messages, tags, campaign titles) end up
// in exported CSVs that organizers/admins open in Excel or Google Sheets. A
// value like `=HYPERLINK(...)`, `=cmd|...`, or `+2+3` is executed as a formula
// by spreadsheet apps (CSV / formula injection). `escapeCsvCell` neutralizes
// this by prefixing a leading formula-trigger character with a single quote,
// while preserving plain numbers, then applies normal structural quoting.
// ─────────────────────────────────────────────────────────────────────────────

const NUMERIC = /^-?\d+(\.\d+)?$/;
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);

  // Neutralize formula injection — but leave genuine numbers (incl. negatives)
  // untouched so numeric columns still parse as numbers.
  if (!NUMERIC.test(s) && FORMULA_LEAD.test(s)) {
    s = `'${s}`;
  }

  // Structural escaping: quote if the cell contains a delimiter/quote/newline.
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }

  return s;
}

// Record-based CSV: header names are used to pull each row's cells.
export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(',')),
  ].join('\n');
}

// Array-based CSV: caller supplies an explicit header row followed by rows.
export function rowsToCsv(headerRow: (string | number)[], rows: (string | number)[][]): string {
  return [headerRow, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
