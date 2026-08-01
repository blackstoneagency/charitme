import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// A bare `1fr` grid track is `minmax(auto, 1fr)`. The `auto` minimum means the
// track grows to its widest child's MIN-CONTENT rather than shrinking to the
// container — so one unbreakable child drags the whole column, and every sibling
// with it, past the edge of the phone.
//
// This repo has paid for that three times, each documented in globals.css: the
// /ai-fundraising hero (390px track inside a 280px container), the campaign
// donate card, and the homepage hero — where the audit blamed `.mirror-hero-copy`
// while the real culprit was a 536px dot row two elements away.
//
// It is invisible to every other check. The CSS is valid, the page renders, and
// at desktop widths it looks perfect. Only a track that can shrink prevents it,
// so inside mobile media blocks every `1fr` must be `minmax(0, 1fr)`.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/** Track lists inside `@media (max-width: N)` blocks where N ≤ this. */
const MOBILE_CEILING = 1024;

type Decl = { line: number; width: number; value: string };

function mobileGridDeclarations(): Decl[] {
  const lines = CSS.split('\n');
  const out: Decl[] = [];
  const stack: number[] = [];
  let depth = 0;

  lines.forEach((line, index) => {
    const media = /^\s*@media\s*\(max-width:\s*(\d+)px\)/.exec(line);
    if (line.trim().startsWith('@media') && line.includes('{')) {
      stack.push(media ? Number(media[1]) : Number.POSITIVE_INFINITY);
    }
    depth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);
    while (stack.length > depth) stack.pop();
    if (stack.length === 0) return;
    if (Math.min(...stack) > MOBILE_CEILING) return;

    for (const m of line.matchAll(/grid-template-columns:\s*([^;}]+)/g)) {
      out.push({ line: index + 1, width: Math.min(...stack), value: m[1].trim() });
    }
  });
  return out;
}

/** Split a track list on top-level whitespace, keeping bracketed groups intact. */
function splitTracks(value: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (buf) { out.push(buf); buf = ''; }
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function bareFrTracks(value: string): boolean {
  for (const token of splitTracks(value)) {
    const repeat = /^repeat\(\s*[^,]+,\s*(.+)\)$/.exec(token);
    if (repeat && repeat[1].trim() === '1fr') return true;
    if (token === '1fr') return true;
  }
  return false;
}

describe('mobile grid tracks can shrink', () => {
  it('scans a real stylesheet', () => {
    // Without this the sweep below passes vacuously if the parse breaks.
    expect(mobileGridDeclarations().length).toBeGreaterThan(50);
  });

  it('uses minmax(0, 1fr) rather than a bare 1fr in every mobile block', () => {
    const offenders = mobileGridDeclarations()
      .filter((d) => bareFrTracks(d.value))
      .map((d) => `globals.css:${d.line} (max-width: ${d.width}px) — ${d.value}`);
    expect(
      offenders,
      'a bare `1fr` track grows to its widest child instead of shrinking to the ' +
      'container, which is how a single wide element pushes a whole page off a ' +
      `phone. Use minmax(0, 1fr):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('detects a bare track when one is present', () => {
    // A guard that has never fired proves nothing about the guard.
    expect(bareFrTracks('1fr')).toBe(true);
    expect(bareFrTracks('repeat(2, 1fr)')).toBe(true);
    expect(bareFrTracks('220px 1fr auto')).toBe(true);
  });

  it('accepts the forms that are already safe', () => {
    expect(bareFrTracks('minmax(0, 1fr)')).toBe(false);
    expect(bareFrTracks('repeat(2, minmax(0, 1fr))')).toBe(false);
    expect(bareFrTracks('220px minmax(0, 1fr) auto')).toBe(false);
    expect(bareFrTracks('repeat(auto-fill, minmax(min(100%, 268px), 1fr))')).toBe(false);
    expect(bareFrTracks('none')).toBe(false);
  });
});
