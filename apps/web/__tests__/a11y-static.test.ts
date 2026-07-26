import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Static accessibility guard.
//
// `e2e/accessibility.spec.ts` runs axe against real pages and is the stronger
// check — but it can only reach routes that render without a database, so the
// entire authenticated surface (dashboard, admin, donor) is invisible to it in
// CI and in this sandbox. These two defects are detectable in source, so they
// get a guard that covers the auth-gated surface too.
//
// Found by this guard when it was written: two icon-only "sliders" filter
// buttons in the admin card header (KindFundApp, CharitMeApp) with no
// accessible name — a screen reader announced them as just "button".
// ─────────────────────────────────────────────────────────────────────────────

const ROOTS = ['app', 'components'].map((d) => join(__dirname, '..', d));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const rel = (f: string) => {
  const i = Math.max(f.indexOf(`app${sep}`), f.indexOf(`components${sep}`));
  return i >= 0 ? f.slice(i) : f;
};

const files = ROOTS.flatMap(walk);

describe('static accessibility guard', () => {
  it('scans a meaningful number of components', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('every <img> has an alt attribute (decorative images use alt="")', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<img\s[^>]*?\/?>/g)) {
        if (!m[0].includes('alt=')) {
          offenders.push(`${rel(f)}:${src.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(offenders, `<img> without alt — add descriptive text, or alt="" if decorative:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('icon-only buttons carry an accessible name', () => {
    // A <button> whose entire content is one JSX element (an icon component or
    // inline svg) and which has no aria-label/aria-labelledby announces as just
    // "button". Text buttons and buttons with a label are unaffected.
    const ICON_ONLY_BUTTON =
      /<button\b(?![^>]*aria-label)(?![^>]*aria-labelledby)[^>]*>\s*(?:<[A-Z][^>]*\/>|<svg\b[\s\S]*?<\/svg>)\s*<\/button>/g;
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(ICON_ONLY_BUTTON)) {
        offenders.push(`${rel(f)}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(offenders, `Icon-only <button> with no accessible name — add aria-label:\n${offenders.join('\n')}`).toEqual([]);
  });
});
