import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Guard against controls that lie.
//
// Ten dead controls were removed from /dashboard/settings in the 2026-07-26
// audit. Six shared this exact signature — a no-op handler:
//
//     <PrefRow label="Product updates" checked={false} onChange={() => null} />
//
// They rendered as normal, sat above a Save button that reported "Preferences
// saved!", and did nothing at all. The five NotifRow toggles were worse: they
// held local state, so they *visibly moved* when clicked and only revealed
// themselves on reload.
//
// A no-op handler is never the right way to express "not editable". React has
// `readOnly` and `disabled` for that, and both are honoured below. This makes the
// pattern fail in CI instead of shipping as a control that quietly does nothing.
// ─────────────────────────────────────────────────────────────────────────────

const APP_WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'components'];

/** Handlers that accept the event and deliberately do nothing. */
const NO_OP_HANDLER =
  /\bon(?:Change|Click|Input|Submit|Toggle)=\{\s*\(\s*[\w,\s]*\)\s*=>\s*(?:null|undefined|\{\s*\})\s*\}/g;

function listSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(p);
    }
  };
  walk(root);
  return out;
}

/**
 * Returns each no-op handler in the file, minus ones on an element that also
 * declares `readOnly` or `disabled` — those state the intent honestly, so the
 * handler is just satisfying React's controlled-input requirement.
 */
function findNoOpHandlers(source: string): string[] {
  const hits: string[] = [];
  for (const m of source.matchAll(NO_OP_HANDLER)) {
    const at = m.index ?? 0;
    // Look at the surrounding JSX element for an honest opt-out.
    const open = source.lastIndexOf('<', at);
    const close = source.indexOf('>', at);
    const element = source.slice(open === -1 ? 0 : open, close === -1 ? source.length : close);
    if (/\b(readOnly|disabled)\b/.test(element)) continue;
    hits.push(m[0]);
  }
  return hits;
}

describe('no inert controls', () => {
  it('no interactive element has a no-op handler', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of listSourceFiles(join(APP_WEB_ROOT, dir))) {
        const hits = findNoOpHandlers(readFileSync(file, 'utf8'));
        for (const h of hits) offenders.push(`${relative(APP_WEB_ROOT, file)}  →  ${h}`);
      }
    }
    expect(
      offenders,
      `These controls render as interactive but do nothing when used. Wire them to\n` +
        `real state, or mark them readOnly/disabled so the UI stops implying they\n` +
        `work. Six controls of exactly this shape shipped in /dashboard/settings\n` +
        `above a Save button that reported success:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('the guard is non-vacuous, and honours readOnly/disabled', () => {
    // The real shape that shipped.
    expect(findNoOpHandlers(`<PrefRow checked={false} onChange={() => null} />`)).toHaveLength(1);
    expect(findNoOpHandlers(`<button onClick={() => {}}>Save</button>`)).toHaveLength(1);
    expect(findNoOpHandlers(`<input onChange={(e) => undefined} />`)).toHaveLength(1);
    // Honest opt-outs are allowed — React wants a handler on a controlled input.
    expect(findNoOpHandlers(`<input value={v} readOnly onChange={() => null} />`)).toHaveLength(0);
    expect(findNoOpHandlers(`<button disabled onClick={() => {}}>x</button>`)).toHaveLength(0);
    // A real handler is untouched.
    expect(findNoOpHandlers(`<input onChange={(e) => setName(e.target.value)} />`)).toHaveLength(0);
  });
});
