import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Every `supabaseAdmin` read on a PAGE must be able to fail without a 500.
//
// `supabaseAdmin` is a Proxy whose `get` trap THROWS when the service-role env
// vars are missing or the client cannot be constructed. So `supabaseAdmin.from`
// throws SYNCHRONOUSLY — not as a rejection, and not as `{ error }`. Every
// `if (error)` branch on this site is blind to it, which is how ~39 pages
// returned 500 on a degraded database while each one already had an empty state
// written and ready to render.
//
// A read is considered guarded when it is:
//   1. lexically inside a `try { … }`, or
//   2. inside a `boundedQuery(() => …)` thunk — the thunk is what moves query
//      CONSTRUCTION inside the helper's try, and is why boundedQuery takes a
//      function (see lib/query-timeout.ts), or
//   3. inside a function whose name is called from inside a try block in the
//      same file — the caller-guards-callee shape, which is how
//      /success-stories was already safe despite looking unguarded.
//
// Rule 3 is not a loophole: it requires the name to actually appear inside a
// try in the same module, so deleting that try makes this test fail.
// ─────────────────────────────────────────────────────────────────────────────

const APP = join(__dirname, '..', 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('page.tsx')) out.push(p);
  }
  return out;
}

/**
 * Replace comment and string/template contents with spaces, preserving every
 * offset and newline, so braces inside them cannot desynchronise the matcher.
 */
function blank(src: string): string {
  const a = src.split('');
  const pad = (s: number, e: number) => {
    for (let k = s; k < e && k < a.length; k++) if (a[k] !== '\n') a[k] = ' ';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = src.length;
      pad(i, j);
      i = j;
    } else if (c === '/' && n === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? src.length : j + 2;
      pad(i, j);
      i = j;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') j += 2;
        else if (src[j] === c) { j++; break; }
        else j++;
      }
      pad(i + 1, j - 1);
      i = j;
    } else i++;
  }
  return a.join('');
}

/** Balanced ranges for a construct opening with `open` after a regex match. */
function ranges(code: string, re: RegExp, open: string, close: string, skip: number): [number, number][] {
  const out: [number, number][] = [];
  for (const m of code.matchAll(re)) {
    const start = m.index!;
    let depth = 1;
    let k = start + skip;
    while (k < code.length && depth > 0) {
      if (code[k] === open) depth++;
      else if (code[k] === close) depth--;
      k++;
    }
    out.push([start, k]);
  }
  return out;
}

const inside = (rs: [number, number][], i: number) => rs.some(([s, e]) => i >= s && i < e);

/**
 * Name of the nearest enclosing FUNCTION preceding `offset`.
 *
 * Deliberately not "nearest declaration": `const cols = await campaignColumns()`
 * is a local variable, and treating it as the enclosing function made the whole
 * caller-guards-callee rule miss (it reported `in cols` for /success-stories).
 * So the const form must be followed by something that actually produces a
 * function — an arrow, `function`, `async`, or a `cache(…)` wrapper.
 */
function enclosingFnName(code: string, offset: number): string | null {
  const before = code.slice(0, offset);
  const decls = [
    ...before.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g),
    ...before.matchAll(
      /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\(\s*(?:async\s*)?\()/g,
    ),
  ];
  if (!decls.length) return null;
  decls.sort((a, b) => a.index! - b.index!);
  return decls[decls.length - 1][1];
}

interface Unguarded { file: string; line: number; fn: string | null }

export function findUnguardedReads(files: string[]): Unguarded[] {
  const bad: Unguarded[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('supabaseAdmin')) continue;
    const code = blank(src);

    const tries = ranges(code, /\btry\s*\{/g, '{', '}', 0);
    const thunks = ranges(code, /\bboundedQuery\(\(\)\s*=>/g, '(', ')', 'boundedQuery('.length);
    // Names invoked from inside a try block — rule 3.
    const guardedNames = new Set<string>();
    for (const [s, e] of tries) {
      for (const m of code.slice(s, e).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) guardedNames.add(m[1]);
    }

    for (const m of code.matchAll(/supabaseAdmin\s*\./g)) {
      const i = m.index!;
      if (inside(tries, i) || inside(thunks, i)) continue;
      const fn = enclosingFnName(code, i);
      if (fn && guardedNames.has(fn)) continue;
      bad.push({ file: file.slice(file.indexOf('/app/') + 1), line: code.slice(0, i).split('\n').length, fn });
    }
  }
  return bad;
}

describe('pages survive a degraded Supabase', () => {
  const pages = walk(APP);

  it('scans a real, non-trivial set of pages', () => {
    // Without this the suite passes vacuously if `walk` ever stops finding files.
    expect(pages.length).toBeGreaterThan(80);
    expect(pages.filter((p) => readFileSync(p, 'utf8').includes('supabaseAdmin')).length).toBeGreaterThan(20);
  });

  it('has no unguarded supabaseAdmin read on any non-admin page', () => {
    const bad = findUnguardedReads(pages.filter((p) => !p.includes('/admin/')));
    expect(
      bad.map((b) => `${b.file}:${b.line}${b.fn ? ` (in ${b.fn})` : ''}`),
      'A synchronous throw from the supabaseAdmin Proxy here 500s the page. Wrap the read in boundedQuery(() => …) or a try/catch that renders a degraded state.',
    ).toEqual([]);
  });

  /**
   * Admin pages are held to the same rule, with one deliberate exception.
   *
   * The exception is a WRITE, not a read: /admin/countries seeds the supported
   * -country table, and a write must stay loud. Routing a failed INSERT into
   * `{ data: null, error }` and carrying on is how a silent partial seed
   * happens — the page crashing is the correct, visible outcome there.
   *
   * The allowlist is exact (file + the fact that it is an insert), so it cannot
   * quietly grow to cover a read.
   */
  it('has no unguarded supabaseAdmin READ on any admin page either', () => {
    const bad = findUnguardedReads(pages.filter((p) => p.includes('/admin/')));
    const unexpected = bad.filter((b) => {
      if (!b.file.endsWith('app/admin/countries/page.tsx')) return true;
      const line = readFileSync(join(APP, 'admin', 'countries', 'page.tsx'), 'utf8').split('\n')[b.line - 1];
      return !/\.insert\(/.test(line); // reads here are still failures
    });
    expect(
      unexpected.map((b) => `${b.file}:${b.line}${b.fn ? ` (in ${b.fn})` : ''}`),
      'Admin pages must degrade too — wrap the read in boundedQuery(() => …). Only the supported_countries seed INSERT is exempt, because a failed write must stay loud.',
    ).toEqual([]);
    // The exemption must still be earned: if the seed insert ever disappears,
    // this allowlist should be deleted rather than left as dead permission.
    expect(bad.length, 'the documented admin exemption no longer exists — remove it').toBe(1);
  });

  // ── A degraded read must never be mistaken for measured data ──────────────
  //
  // Making reads degrade gracefully has a failure mode of its own: code that
  // previously CRASHED on a bad read now continues with a fallback value, and if
  // that fallback gates a write, a read outage starts causing writes.
  //
  // /admin/countries seeds the supported-country list "on first visit" behind
  // `if ((count ?? 0) > 0) return;`. Once the count read degrades to undefined
  // instead of throwing, that reads as "table is empty" and falls through to
  // inserting the entire country list over a table that may already be full.
  it('never seeds supported_countries off an unmeasured count', () => {
    const raw = readFileSync(join(APP, 'admin', 'countries', 'page.tsx'), 'utf8');
    const from = raw.indexOf('async function maybeSeed');
    const to = raw.indexOf('const fundraisers');
    // Anchors checked on RAW source: `blank()` empties string literals too, so
    // the table name is only visible before blanking. Without this the slice
    // could silently become empty and the assertions below would pass vacuously.
    expect(from, 'maybeSeed must exist for this guard to mean anything').toBeGreaterThan(-1);
    expect(raw.slice(from, to), 'the seed block must still read supported_countries').toContain('supported_countries');
    // Pattern matched on BLANKED source: the fix's own comment QUOTES the old
    // `(count ?? 0)` form to explain it, and matching that would make this
    // assertion permanently red for describing the bug it prevents.
    const seed = blank(raw).slice(from, to);
    expect(
      seed,
      'a failed count must not fall through to the seed INSERT — check `error` and that `count` is a real number',
    ).not.toMatch(/\(\s*count\s*\?\?\s*0\s*\)/);
    expect(seed, 'the read error must be inspected before writing').toMatch(/\berror\b/);
  });

  // ── Mutation checks: the detector must actually detect ────────────────────
  it('flags a raw unguarded read (detector is not vacuous)', () => {
    const tmp = join(APP, '..', '__tests__', '__fixtures__');
    // Use an in-memory equivalent rather than writing files: exercise the same
    // logic on a synthetic module by round-tripping through a temp path is
    // unnecessary — the planted source is checked directly below.
    void tmp;
    const planted = `import { supabaseAdmin } from './supabase';
export default async function P() {
  const { data } = await supabaseAdmin.from('campaigns').select('id');
  return data;
}`;
    expect(countUnguarded(planted)).toBe(1);
  });

  it('does not flag a read inside a boundedQuery thunk', () => {
    const ok = `export default async function P() {
  const { data } = await boundedQuery(() => supabaseAdmin.from('campaigns').select('id'));
  return data;
}`;
    expect(countUnguarded(ok)).toBe(0);
  });

  it('does not flag a read inside a try block', () => {
    const ok = `export default async function P() {
  try { return (await supabaseAdmin.from('c').select('id')).data; } catch { return []; }
}`;
    expect(countUnguarded(ok)).toBe(0);
  });

  it('does not flag the caller-guards-callee shape, but does once the try is removed', () => {
    const guarded = `async function load() {
  const { data } = await supabaseAdmin.from('c').select('id');
  return data;
}
async function outer() {
  try { return await load(); } catch { return []; }
}`;
    expect(countUnguarded(guarded)).toBe(0);
    expect(countUnguarded(guarded.replace('try { return await load(); } catch { return []; }', 'return await load();'))).toBe(1);
  });
});

/** Run the same detector over a source string. */
function countUnguarded(src: string): number {
  const code = blank(src);
  const tries = ranges(code, /\btry\s*\{/g, '{', '}', 0);
  const thunks = ranges(code, /\bboundedQuery\(\(\)\s*=>/g, '(', ')', 'boundedQuery('.length);
  const guardedNames = new Set<string>();
  for (const [s, e] of tries) {
    for (const m of code.slice(s, e).matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) guardedNames.add(m[1]);
  }
  let n = 0;
  for (const m of code.matchAll(/supabaseAdmin\s*\./g)) {
    const i = m.index!;
    if (inside(tries, i) || inside(thunks, i)) continue;
    const fn = enclosingFnName(code, i);
    if (fn && guardedNames.has(fn)) continue;
    n++;
  }
  return n;
}
