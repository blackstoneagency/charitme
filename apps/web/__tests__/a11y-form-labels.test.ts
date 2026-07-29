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
// This began as a ratchet against 200 offenders (really ~161 once the scanner
// stopped miscounting). It is now a HARD GUARD at zero: every form control in
// app/ and components/ has an accessible name, so any new one without a label
// fails immediately rather than being absorbed into a backlog.
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

/** Zero as of 2026-07-28. This is now a hard guard, not a ratchet. */
const BASELINE = 0;

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
      // Comments are blanked, length-preserving so line numbers stay accurate.
      // Without this the scan matches prose: DonationsClient carries the comment
      // "These two used to be unbound <select>s whose value was never read",
      // which was reported as an unnamed control. A guard that flags its own
      // explanatory text teaches people to ignore it.
      const raw = readFileSync(file, 'utf8');
      const src = raw
        .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
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

  it('is actually finding controls, so zero means checked rather than blind', () => {
    // A scan that matches nothing also reports zero offenders. This asserts the
    // scan still sees the controls it is passing judgement on — the difference
    // between "all named" and "found none". The instrument was wrong three
    // separate ways during this work, so zero needs corroboration.
    let scanned = 0;
    for (const dir of ['app', 'components']) {
      for (const file of tsxFiles(join(WEB, dir))) {
        scanned += [...readFileSync(file, 'utf8').matchAll(CONTROL_OPEN)].length;
      }
    }
    expect(scanned).toBeGreaterThan(400);
  });
});
