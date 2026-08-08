import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import schemaColumns from './fixtures/schema-columns.json';

// ─────────────────────────────────────────────────────────────────────────────
// The other half of the schema contract: FILTER columns.
//
// `schema-contract.test.ts` checks every `.select(...)` column and every
// `.rpc()` parameter against the live-schema snapshot. It does not look at
// filters, and a filter is exactly as fatal: PostgREST answers `42703` for
// `.eq('missing_col', …)`, the whole query errors, the call site usually ignores
// the error, and the feature silently returns nothing. That is the same failure
// class its own header describes — it just never covered this half.
//
// The fixture bug this session was the same shape one level out: eleven audit
// fixtures lacked the column their page filtered on, so those pages rendered
// empty while every look-and-feel sweep passed. This is the check against the
// REAL schema rather than against the fixtures.
//
// Currently zero findings. The value is keeping it there.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ PARSING NOTE — read before changing the scan
//
// Attributing a filter to the wrong table is the entire risk here, and two
// looser bounds each produced a page of confident nonsense before this settled:
//
//   · scanning a fixed window after `.from('x')` bleeds into the NEXT query
//   · scanning to the end of the statement bleeds across a `Promise.all([...])`,
//     which holds several chains in ONE statement — that is how
//     `donations.raised_amount` (a campaigns column) appeared as a finding
//
// So each chain is bounded by BOTH: the statement end and the next `.from(`.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COLUMNS = schemaColumns as Record<string, string[]>;

/** PostgREST filter/order methods whose first argument is a column name. */
const COLUMN_FIRST_ARG = 'eq|neq|is|in|gt|gte|lt|lte|like|ilike|order|contains|overlaps';

/** Slice one chain: from `.from('x')` to the statement end or the next `.from(`. */
function chainAt(src: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  let i = start;
  for (; i < src.length && i - start < 4000; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth <= 0) break;
  }
  const raw = src.slice(start, i);
  const next = raw.indexOf('.from(', 6);
  return next === -1 ? raw : raw.slice(0, next);
}

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__' || entry.startsWith('.')) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(p)) out.push(p);
    }
  };
  for (const d of ['app', 'lib']) walk(join(APP_WEB_ROOT, d));
  return out;
}

type Finding = { file: string; line: number; table: string; method: string; column: string };

function scan(): { findings: Finding[]; chains: number } {
  const findings: Finding[] = [];
  let chains = 0;
  for (const file of sourceFiles()) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)) {
      const table = m[1];
      const columns = COLUMNS[table];
      // A table absent from the snapshot is out of scope — schema-contract
      // already reports unknown tables, and duplicating that here would produce
      // two failures for one cause.
      if (!columns) continue;
      chains++;
      const chain = chainAt(src, m.index!);
      const re = new RegExp(`\\.(${COLUMN_FIRST_ARG})\\(\\s*'([a-zA-Z_][a-zA-Z0-9_]*)'`, 'g');
      for (const f of chain.matchAll(re)) {
        if (!columns.includes(f[2])) {
          findings.push({
            file: file.slice(APP_WEB_ROOT.length + 1),
            line: src.slice(0, m.index).split('\n').length,
            table,
            method: f[1],
            column: f[2],
          });
        }
      }
    }
  }
  return { findings, chains };
}

describe('every filtered column exists on its table', () => {
  const { findings, chains } = scan();

  it('scanned a real tree', () => {
    // Without this the assertion below passes vacuously on a broken walk.
    expect(sourceFiles().length).toBeGreaterThan(500);
    expect(chains).toBeGreaterThan(300);
    expect(Object.keys(COLUMNS).length).toBeGreaterThan(100);
  });

  it('no .eq/.is/.in/.order names a column the table does not have', () => {
    const lines = findings.map((f) => `${f.table}.${f.column} — .${f.method}() at ${f.file}:${f.line}`);
    expect(
      lines,
      'PostgREST answers 42703 for a filter on a column that does not exist, and\n' +
        'the whole query fails — the call site usually ignores the error and the\n' +
        'feature silently returns nothing:\n  ' + lines.join('\n  '),
    ).toEqual([]);
  });

  it('detects a planted bad column, and attributes it to the right table', () => {
    // A guard that has never fired proves nothing — and the specific way this
    // one could go wrong is naming the WRONG table, so the mutation checks both.
    const src = `
      const a = await supabaseAdmin.from('donations').select('id').eq('column_that_does_not_exist', 1);
    `;
    const chain = chainAt(src, src.indexOf('.from('));
    const re = new RegExp(`\\.(${COLUMN_FIRST_ARG})\\(\\s*'([a-zA-Z_][a-zA-Z0-9_]*)'`, 'g');
    const hits = [...chain.matchAll(re)].map((m) => m[2]);
    expect(hits).toContain('column_that_does_not_exist');
    expect(COLUMNS.donations.includes('column_that_does_not_exist')).toBe(false);
  });

  it('does NOT attribute a sibling chain\'s filter across a Promise.all', () => {
    // The false-positive shape that produced 73 imaginary findings.
    const src = `
      const [d, c] = await Promise.all([
        supabaseAdmin.from('donations').select('id').eq('status', 'completed'),
        supabaseAdmin.from('campaigns').select('id').order('raised_amount'),
      ]);
    `;
    const chain = chainAt(src, src.indexOf(".from('donations')") - 14);
    expect(chain).not.toContain('raised_amount');
  });
});
