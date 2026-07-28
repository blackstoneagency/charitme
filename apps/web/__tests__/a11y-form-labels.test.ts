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
const CONTROL_OPEN = /<(input|select|textarea)\b/g;

/**
 * Attributes of one JSX element, read to the tag's real closing `>`.
 *
 * A naive `[^>]*` stops at the FIRST `>` — which, in this codebase, is usually
 * the arrow of an inline handler like `onChange={(e) => …}`. That truncates the
 * attribute list, so any `aria-label` written after a handler is invisible and
 * the control is reported unnamed. Two already-correct date inputs in
 * admin/new-customers were miscounted exactly that way. Brace depth is tracked
 * so a `>` inside `{…}` never ends the tag.
 */
function attributesOf(src: string, tagStart: number): string {
  let depth = 0;
  for (let i = tagStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return src.slice(tagStart, i);
  }
  return src.slice(tagStart);
}
const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image']);

/** Current known debt. Lower it when controls are fixed; never raise it. */
const BASELINE = 75;

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
    // Two valid wrapper shapes:
    //   explicit — renders <label htmlFor> and clones the id onto its child
    //   implicit — renders <label>…{children}…</label>, nesting the control
    // The implicit form is ordinary valid HTML, but the <label> lives in the
    // wrapper's DEFINITION while the control sits at the CALL SITE, so a scan
    // looking for a nearby <label> cannot see the association at all.
    const explicit = /htmlFor=\{/.test(body) && /cloneElement/.test(body);
    const labelOpen = body.indexOf('<label');
    const labelClose = body.indexOf('</label>', labelOpen === -1 ? 0 : labelOpen);
    const implicit =
      labelOpen !== -1 && labelClose > labelOpen && body.slice(labelOpen, labelClose).includes('{children}');
    if (explicit || implicit) found.add(m[1]);
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
      for (const m of src.matchAll(CONTROL_OPEN)) {
        const attrs = attributesOf(src, m.index ?? 0);
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
