import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import schemaColumns from './fixtures/schema-columns.json';
import schemaFunctions from './fixtures/schema-functions.json';

// Anchor scanning to apps/web (this file lives in apps/web/__tests__), NOT
// process.cwd() — the cwd differs between `npm run test -w apps/web` and a
// repo-root `vitest --root apps/web`, and an empty scan would pass trivially.
const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────────────────────────────────────────────────────────
// Schema-contract test.
//
// A route that runs `.from('table').select('a, b, missing_col')` where
// `missing_col` doesn't exist FAILS CLOSED: PostgREST errors the whole query, the
// call site usually ignores the error, and the feature silently returns nothing —
// invisible to normal tests because no unit test drives the authed/admin route
// against the real schema. (This class shipped several fully-broken features:
// PAY-009 tax receipts, PAY-010 exports/refunds/impact/marketing sync.)
//
// This test parses every `.from(table).select(...)` in the app source and asserts
// each selected column exists in the committed schema snapshot
// (`fixtures/schema-columns.json`). Embedded PostgREST relations
// (`profiles!donor_id(...)`, `campaigns(title)`, `alias:relation(...)`) are skipped.
//
// Refresh the snapshot after a schema change:  npm run schema:snapshot
// ─────────────────────────────────────────────────────────────────────────────

const COLUMNS = schemaColumns as Record<string, string[]>;
const KNOWN_TABLES = new Set(Object.keys(COLUMNS));
const FUNCTIONS = schemaFunctions as Record<string, string[]>;

// Directories to scan (relative to apps/web).
const SCAN_DIRS = ['app', 'lib'];

// Tokens that are never real columns.
const NON_COLUMNS = new Set(['*', 'count', '']);

function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
    }
  };
  walk(root);
  return out;
}

/** Split a PostgREST select string on top-level commas (ignoring nested parens). */
function topLevelSplit(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(') { depth++; cur += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; }
    else if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Reduce a select token to the bare column it references, or null to skip. */
function realColumn(token: string): string | null {
  let t = token.trim();
  if (!t) return null;
  // Any token containing "(" is an embedded relation (e.g. campaigns(title)) — skip.
  if (t.includes('(')) return null;
  // Rename syntax `newName:realColumn` — the real column is after the colon.
  if (t.includes(':')) t = t.split(':').pop()!.trim();
  // Strip cast (`col::text`) and JSON ops (`col->>key`, `col->key`).
  t = t.split('::')[0];
  t = t.split('->')[0];
  t = t.trim();
  if (NON_COLUMNS.has(t)) return null;
  if (!/^[a-z_][a-z0-9_]*$/.test(t)) return null;
  return t;
}

type Ref = { file: string; line: number; table: string; column: string };

const FROM_RE = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g;

/**
 * Parse the top-level keys of an object literal starting at `src[open] === '{'`.
 * Tracks strings/templates/comments and nesting so only depth-1 keys are returned.
 * Returns null if the braces don't balance (bail rather than risk a false positive).
 */
function objectKeys(src: string, open: number): string[] | null {
  const keys: string[] = [];
  let i = open + 1;
  let depth = 1;
  let expectKey = true;
  let cur = '';
  const flush = () => {
    const k = cur.trim();
    if (expectKey && k && /^[a-z_][a-z0-9_]*$/.test(k)) keys.push(k);
    cur = '';
  };
  while (i < src.length && depth > 0) {
    const ch = src[i];
    const two = src.slice(i, i + 2);
    if (two === '//') { i = src.indexOf('\n', i); if (i === -1) return null; continue; }
    if (two === '/*') { i = src.indexOf('*/', i); if (i === -1) return null; i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      // skip string literal; a string in key position is not a bare column
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; if (depth === 1) { expectKey = false; } cur = ''; continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; i++; continue; }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0) { flush(); return keys; }
      i++; continue;
    }
    if (depth === 1) {
      if (ch === ',') { flush(); expectKey = true; i++; continue; }
      if (ch === ':') { flush(); expectKey = false; i++; continue; }
      cur += ch;
    }
    i++;
  }
  return depth === 0 ? keys : null;
}

/** Extract the first string-literal argument to the next `.select(` after `idx`. */
function extractSelectArg(src: string, idx: number, boundary: number): string | null {
  const selIdx = src.indexOf('.select(', idx);
  if (selIdx === -1 || selIdx > boundary) return null;
  let i = selIdx + '.select('.length;
  while (i < src.length && /\s/.test(src[i])) i++;
  const quote = src[i];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null; // not a string literal
  i++;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
    if (ch === quote) break;
    out += ch;
    i++;
  }
  return out;
}

function collectRefs(): Ref[] {
  const refs: Ref[] = [];
  for (const dir of SCAN_DIRS) {
    const root = join(APP_WEB_ROOT, dir);
    let files: string[];
    try { files = listSourceFiles(root); } catch { continue; }
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      FROM_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      const froms: { table: string; end: number; start: number }[] = [];
      while ((m = FROM_RE.exec(src))) froms.push({ table: m[1], end: m.index + m[0].length, start: m.index });
      for (let k = 0; k < froms.length; k++) {
        const { table, end, start } = froms[k];
        if (!KNOWN_TABLES.has(table)) continue; // view / unknown relation — skip
        const boundary = k + 1 < froms.length ? froms[k + 1].start : src.length;
        const line = src.slice(0, start).split('\n').length;
        const rel = 'apps/web/' + file.replace(APP_WEB_ROOT + '/', '');

        // ── .select('...') columns ──
        const arg = extractSelectArg(src, end, boundary);
        if (arg !== null && !arg.includes('${')) {
          for (const tok of topLevelSplit(arg)) {
            const col = realColumn(tok);
            if (!col) continue;
            if (!COLUMNS[table].includes(col)) refs.push({ file: rel, line, table, column: col });
          }
        }

        // ── .insert/.update/.upsert({ ... }) object keys ──
        // Only when DIRECTLY chained to this .from() (no intervening .from(, `;`,
        // or function boundary) — filters/writes applied to a query stored in a
        // variable can't be attributed to a table statically, so we skip them.
        const region = src.slice(end, boundary);
        const wm = /\.(insert|update|upsert)\(\s*\{/.exec(region);
        if (wm) {
          const pre = region.slice(0, wm.index);
          if (!/\.from\(|;|function|=>/.test(pre)) {
            const braceIdx = end + wm.index + wm[0].length - 1; // index of '{'
            const keys = objectKeys(src, braceIdx);
            if (keys) {
              for (const key of keys) {
                if (!COLUMNS[table].includes(key)) refs.push({ file: rel, line, table, column: key });
              }
            }
          }
        }
      }
    }
  }
  return refs;
}

type RpcRef = { file: string; line: number; fn: string; param: string };

const RPC_RE = /\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*,\s*\{/g;

/**
 * Validate `.rpc('fn', { p_x: ... })` parameter keys against the function's known
 * named parameters. Only functions present in the snapshot WITH named params are
 * checked — unknown names (Postgres built-ins like pg_notify, extension functions)
 * and no-named-param functions are skipped, so this stays false-positive-free.
 */
function collectRpcRefs(): RpcRef[] {
  const refs: RpcRef[] = [];
  for (const dir of SCAN_DIRS) {
    const root = join(APP_WEB_ROOT, dir);
    let files: string[];
    try { files = listSourceFiles(root); } catch { continue; }
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      RPC_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = RPC_RE.exec(src))) {
        const fn = m[1];
        const params = FUNCTIONS[fn];
        if (!params || params.length === 0) continue; // unknown / no named params — skip
        const braceIdx = m.index + m[0].length - 1; // index of '{'
        const keys = objectKeys(src, braceIdx);
        if (!keys) continue;
        const line = src.slice(0, m.index).split('\n').length;
        const rel = 'apps/web/' + file.replace(APP_WEB_ROOT + '/', '');
        for (const key of keys) {
          if (!params.includes(key)) refs.push({ file: rel, line, fn, param: key });
        }
      }
    }
  }
  return refs;
}

describe('schema contract: .select() columns exist in the schema snapshot', () => {
  it('every selected column exists on its table', () => {
    const bad = collectRefs();
    const message =
      bad.length === 0
        ? ''
        : 'Routes select columns that do not exist in fixtures/schema-columns.json ' +
          '(these fail closed at runtime — fix the query or add the column via migration; ' +
          'if the snapshot is stale run `npm run schema:snapshot`):\n' +
          bad.map((b) => `  ${b.file}:${b.line}  ${b.table}.${b.column}`).join('\n');
    expect(bad, message).toEqual([]);
  });

  it('every .rpc() parameter exists on the function', () => {
    const bad = collectRpcRefs();
    const message =
      bad.length === 0
        ? ''
        : 'RPC calls pass parameters that do not exist on the function ' +
          '(these error at runtime; fix the call or the migration; refresh the ' +
          'snapshot with `npm run schema:snapshot`):\n' +
          bad.map((b) => `  ${b.file}:${b.line}  ${b.fn}(${b.param})`).join('\n');
    expect(bad, message).toEqual([]);
  });
});
