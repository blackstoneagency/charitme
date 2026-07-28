import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Form controls with no accessible name — the gap the axe sweep cannot see.
//
// The public axe sweep reports 0 violations across 38 routes, and that is true.
// It is also nearly blind to this app's forms: almost every form lives behind
// auth (/admin/*, /dashboard/*), where an anonymous crawler only ever gets a
// redirect to /login. "0 axe violations" and "19 unlabelled settings controls"
// were both true at the same time.
//
// The other reason it hid: axe accepts a `placeholder` as a fallback accessible
// name. Most controls here have one, so they pass — and the placeholder
// disappears the moment the user types, which is exactly when a screen-reader
// user still needs to know what the field is. Passing that way is cosmetic, so
// a placeholder deliberately does NOT count below.
//
// A control counts as named when it carries `aria-label`, `aria-labelledby`, or
// an `id` (which a `<label htmlFor>` can point at), or when it sits inside a
// `<label>` element.
//
// Controls wrapped by a LABELLING WRAPPER count as named. A wrapper that renders
// `<label htmlFor>` and forwards the id onto its child via cloneElement — as
// dashboard/settings' SetField and admin/system's Field do — genuinely labels
// the control, but the id exists only at runtime and a naive scan cannot see it.
// Without this the metric punishes the fix: 37 controls were repaired in
// admin/system and the count did not move.
//
// This is a RATCHET, not a clean bill of health. 200 offenders exist today and
// fixing them is a large mechanical job; what this prevents is the number
// growing while nobody is looking.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = join(__dirname, '..');
const CONTROL = /<(input|select|textarea)\b([^>]*?)\/?>/g;
const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image']);

/** Current known debt. Lower it when controls are fixed; never raise it. */
const BASELINE = 154;

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Components in this file that render `<label htmlFor>` AND clone an id onto
 * their child. Controls nested in one of these are labelled at runtime.
 */
function labellingWrappers(src: string): Set<string> {
  const found = new Set<string>();
  for (const m of src.matchAll(/function\s+([A-Z]\w*)\s*\(/g)) {
    const start = m.index ?? 0;
    const next = src.slice(start + 1).search(/\nfunction\s+[A-Z]\w*\s*\(|\nexport default/);
    const body = src.slice(start, next === -1 ? undefined : start + 1 + next);
    if (/htmlFor=\{/.test(body) && /cloneElement/.test(body)) found.add(m[1]);
  }
  return found;
}

/** True when the control sits inside one of the file's labelling wrappers. */
function insideLabellingWrapper(src: string, index: number, wrappers: Set<string>): boolean {
  if (wrappers.size === 0) return false;
  const before = src.slice(0, index);
  for (const name of wrappers) {
    const opens = [...before.matchAll(new RegExp(`<${name}\\b`, 'g'))].map((m) => m.index ?? -1);
    if (opens.length === 0) continue;
    const last = opens[opens.length - 1];
    const close = src.indexOf(`</${name}>`, last);
    if (close !== -1 && close > index) return true;
  }
  return false;
}

function insideLabel(src: string, index: number): boolean {
  const opens = [...src.matchAll(/<label\b/g)].map((m) => m.index ?? -1).filter((i) => i > -1 && i < index);
  if (opens.length === 0) return false;
  const close = src.indexOf('</label>', opens[opens.length - 1]);
  return close !== -1 && close > index;
}

function findOffenders(): string[] {
  const offenders: string[] = [];
  for (const dir of ['app', 'components']) {
    for (const file of tsxFiles(join(WEB, dir))) {
      const src = readFileSync(file, 'utf8');
      const wrappers = labellingWrappers(src);
      for (const m of src.matchAll(CONTROL)) {
        const attrs = m[2] ?? '';
        const type = /type=["{]?\s*['"]?(\w+)/.exec(attrs)?.[1] ?? 'text';
        if (SKIP_TYPES.has(type)) continue;
        if (/aria-label|aria-labelledby|\bid=/.test(attrs)) continue;
        if (insideLabel(src, m.index ?? 0)) continue;
        if (insideLabellingWrapper(src, m.index ?? 0, wrappers)) continue;
        offenders.push(`${relative(WEB, file)}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
  }
  return offenders;
}

describe('form controls carry an accessible name', () => {
  const offenders = findOffenders();

  it('scans a meaningful number of files', () => {
    // Guards against the walker silently matching nothing and "passing".
    expect(tsxFiles(join(WEB, 'app')).length).toBeGreaterThan(100);
  });

  it('does not add new unlabelled controls', () => {
    const worst = offenders.slice(0, 10).join('\n  ');
    expect(
      offenders.length,
      `Unlabelled form controls rose to ${offenders.length} (baseline ${BASELINE}).\n` +
        'A placeholder is NOT an accessible name — it vanishes once the user types.\n' +
        'Add aria-label, or an id paired with <label htmlFor>, or wrap it in <label>.\n  ' +
        worst,
    ).toBeLessThanOrEqual(BASELINE);
  });

  it('has a baseline that matches reality, so progress is visible', () => {
    // If the count drops well below the baseline, lower BASELINE in the same
    // commit — otherwise the ratchet stops ratcheting.
    expect(
      offenders.length,
      `Only ${offenders.length} offenders remain; lower BASELINE to ${offenders.length}.`,
    ).toBeGreaterThan(BASELINE - 25);
  });
});
