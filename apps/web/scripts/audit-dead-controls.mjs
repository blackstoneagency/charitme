#!/usr/bin/env node
/**
 * Find form controls that LOOK saved but are never sent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUG THIS EXISTS FOR
 *
 * /dashboard/settings shipped five controls — Default Date Range, Country,
 * Default Dashboard View, Email Frequency, and one more — that were bound to
 * nothing. A user changed one, got a green "Preferences saved!" toast, and the
 * value was never in the request body. Nothing consumed it anywhere. Each sat
 * beside working controls under the same success toast, so the page reported
 * saving four things and saved three.
 *
 * That is the worst shape of UI bug: it does not error, it actively confirms.
 * Typecheck cannot see it (the JSX is valid), lint cannot see it (the state is
 * "used" — it is rendered), and a rendering test cannot see it (the control
 * appears and responds). Only the relationship between the control and the
 * payload reveals it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW IT DECIDES
 *
 * For each 'use client' component that submits JSON:
 *   1. collect `useState` names bound into a control (`value={x}` / `checked={x}`)
 *   2. collect every identifier appearing inside a `JSON.stringify({...})` body
 *   3. a bound control whose state never appears in ANY payload is suspect
 *
 * ⚠️ SUSPECT, NOT GUILTY. Legitimate reasons a bound value is absent from a
 * payload: it is a filter or search box, a UI toggle (tab, modal, disclosure),
 * a derived/preview field, or it is submitted via FormData rather than JSON.
 * The point is to produce a SHORT list a human reads — not to fail a build.
 * Every hit needs opening the file, which is how the five real ones were
 * confirmed and how the false ones get dismissed.
 *
 * Usage: node scripts/audit-dead-controls.mjs [--all]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOW_ALL = process.argv.includes('--all');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) {
      if (e === 'node_modules' || e === '.next') continue;
      walk(full, out);
    } else if (/\.tsx$/.test(e)) out.push(full);
  }
  return out;
}

// Names that are almost always genuine UI state rather than a saved field.
// Kept deliberately small: a long ignore list turns a finding into a silence.
const UI_STATE = /^(open|show|is[A-Z]|active|selected|current|tab|view|mode|busy|saving|loading|error|toast|msg|message|query|q|search|filter|sort|page|expanded|editing|copied|step|preview|draft)/;

// Controls that look dead to the occurrence rule but are verifiably wired.
// Each entry needs a REASON — this is how a real dead control would get silenced,
// so it stays short and every line names the mechanism.
//
// The shape they share: the component passes its SETTER to a shared saver and
// builds the payload from a computed key —
//   onChange={(v) => updatePreference('notification_email', v, setNotifyEmail)}
//   body: JSON.stringify({ [key]: value })
// The value travels as `v`, and the payload key is a string literal, so the
// state name legitimately never appears a third time.
const VERIFIED_WIRED = new Map([
  ['app/profile/ProfileForm.tsx:notifyEmail', 'updatePreference("notification_email", v, setter) → JSON.stringify({ [key]: value })'],
  ['app/profile/ProfileForm.tsx:notifyUpdates', 'updatePreference("notification_updates", v, setter)'],
  ['app/profile/ProfileForm.tsx:notifyMarketing', 'updatePreference("notification_marketing", v, setter)'],
]);

const files = [...walk(path.join(WEB_ROOT, 'app')), ...walk(path.join(WEB_ROOT, 'components'))];
const findings = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes("'use client'")) continue;
  if (!src.includes('JSON.stringify(')) continue; // no JSON submit: not this check's business

  // 1. state that is bound into a control
  const bound = new Map(); // name -> line
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(?:value|checked)=\{([A-Za-z_$][\w$]*)\}/g)) {
      const name = m[1];
      if (!bound.has(name)) bound.set(name, i + 1);
    }
  });
  if (bound.size === 0) continue;

  // Only consider names that are actually useState — props and constants are
  // someone else's contract, not a control this component claims to save.
  const stateNames = new Set(
    [...src.matchAll(/const\s*\[\s*([A-Za-z_$][\w$]*)\s*,/g)].map((m) => m[1]),
  );

  // 2. THE RULE: a dead control is declared, rendered, and read NOWHERE else.
  //
  // The first version compared bound names against identifiers inside
  // `JSON.stringify({...})` and produced 37 hits, nearly all wrong. Real code
  // does not hand raw state to the payload:
  //   • it derives  — `Number.parseFloat(newAmount)` then sends `dollars`
  //   • it routes   — `fetch(\`/api/campaigns/${campaignId}/updates\`)`, id in the URL
  //   • it collects — `const payload = {...}` built before the stringify call
  // Each of those is correct, and flagging them buries the real thing.
  //
  // Counting occurrences sidesteps all three. A control the component actually
  // uses is referenced a third time somewhere — validated, derived, reset, or
  // put in a URL. One that appears exactly twice is bound to a `useState` and
  // rendered, and then nothing ever reads it. That is the Default Date Range
  // signature exactly.
  for (const [name, line] of bound) {
    if (!stateNames.has(name)) continue;
    if (UI_STATE.test(name)) continue;
    const uses = (src.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
    // declaration + JSX binding = 2. Anything more means something reads it.
    if (uses > 2) continue;
    const rel = path.relative(WEB_ROOT, file);
    if (VERIFIED_WIRED.has(`${rel}:${name}`)) continue;
    findings.push({ file: rel, name, line, uses });
  }
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

console.log(`client components submitting JSON: scanned ${files.length} .tsx files`);
console.log(`bound controls with no matching payload field: ${findings.length}\n`);

const shown = SHOW_ALL ? [...byFile] : [...byFile].filter(([, v]) => v.length > 0).slice(0, 25);
for (const [file, list] of shown) {
  console.log(`${file}`);
  for (const f of list) console.log(`    ${f.name}  (bound at line ${f.line}, referenced ${f.uses}x in the file)`);
}
console.log('\nSUSPECT, not guilty — open each file. A bound value legitimately');
console.log('absent from a payload may be a filter, a UI toggle, or a derived field.');
