import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// One definition per component, and one primary-CTA gradient.
//
// A sweep of the rendered site measured **fifteen distinct primary-CTA
// treatments across 53 public pages**, including four violet→magenta gradients
// that differ by a handful of RGB points:
//
//     #7035ff → #ec39c3      #6c35ff → #5016e8
//     #7c3aed → #6c35ff      #4a18f0 → #6023ff
//
// Nobody designed four almost-identical gradients. Each is a copy of the last
// with a nudge, and the result is a site where the main button looks subtly
// different depending which page you are on. A stylesheet cannot be kept
// coherent by review alone at 8,000 lines, so this is the check.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/** Strip comments so documented examples are not read as declarations. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

describe('the primary CTA has one definition', () => {
  it('defines the canonical gradient token', () => {
    expect(CODE).toMatch(/--grad-brand:\s*linear-gradient\(/);
  });

  it('routes every site-wide CTA class through the token', () => {
    // These are the classes that render the primary action on public pages,
    // the dashboard, and the header. They must not carry their own gradient.
    for (const cls of ['.kind-start', '.kf-primary', '.pub-btn.primary', '.mirror-btn-primary']) {
      const rule = new RegExp(
        `\\${cls.replace('.', '\\.')}\\s*\\{[^}]*background:\\s*linear-gradient`,
      );
      expect(CODE, `${cls} declares its own gradient instead of using var(--grad-brand)`)
        .not.toMatch(rule);
    }
  });

  it('has no NEW violet→magenta CTA gradient outside the token', () => {
    // The specific drift that happened. Decorative gradients (avatars, icon
    // tiles, hero washes) are legitimately different and are not matched here —
    // this looks only for the two-stop violet→magenta button ramp.
    const ctaLike = [
      ...CODE.matchAll(/linear-gradient\(\s*135deg\s*,\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi),
    ].filter(([, a, b]) => {
      const violet = (h: string) => {
        const r = parseInt(h.slice(1, 3), 16);
        const g = parseInt(h.slice(3, 5), 16);
        const bl = parseInt(h.slice(5, 7), 16);
        return bl > 150 && r > 60 && g < 110; // purple/violet family
      };
      return violet(a) && violet(b);
    });

    // MEASURED at 28, not guessed — a first pass assumed ~14 and the real count
    // was double that. This is a RATCHET, not an endorsement: 28 near-identical
    // violet ramps in one stylesheet is still too many, and most are decorative
    // surfaces (avatars, assistant icon tiles, hero washes) rather than buttons.
    // The point is that the number can only go DOWN. Consolidating the
    // decorative ones onto a token is real remaining work, tracked in todo.md.
    expect(
      ctaLike.length,
      `violet→violet gradients found: ${ctaLike.length}\n${ctaLike.map((m) => m[0]).join('\n')}\n` +
        'If this is a primary CTA, use var(--grad-brand). Never raise this ceiling — lower it.',
    ).toBeLessThanOrEqual(28);
  });
});

describe('no class is fully redefined with conflicting values', () => {
  it('reports the known duplicate-definition conflicts and no more', () => {
    // `.kf-primary` and `.kf-outline` are each declared TWICE at top level, far
    // apart, with different padding, radius, gap and colours. The later rule
    // wins, so the earlier one — including a box-shadow nobody ever sees — is
    // dead code that reads as authoritative. Pinned rather than deleted: the
    // earlier rules share a selector list with `.kf-danger`, so removing them is
    // a separate, riskier change than this test.
    const topLevel = new Map<string, number[]>();
    const lines = CODE.split('\n');
    let depth = 0;
    let inAtRule = 0;

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (/^@(media|supports)/.test(trimmed)) inAtRule += 1;
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;

      if (depth === 0 && inAtRule === 0 && opens > 0 && !trimmed.startsWith('@')) {
        for (const sel of trimmed.split('{')[0].split(',').map((s) => s.trim())) {
          if (/^\.[a-z][a-z0-9-]*$/.test(sel)) {
            topLevel.set(sel, [...(topLevel.get(sel) ?? []), i + 1]);
          }
        }
      }
      depth += opens - closes;
      if (inAtRule > 0 && depth === 0) inAtRule = 0;
    });

    const multi = [...topLevel.entries()]
      .filter(([, ls]) => ls.length > 1)
      .map(([sel]) => sel)
      .sort();

    // Grew from 25 to this list only if someone adds a new duplicate. The count
    // is what matters; the point is that it must not increase silently.
    expect(
      multi.length,
      `classes defined more than once at top level:\n  ${multi.join(', ')}\n` +
        'A second top-level rule for the same class means the first one is dead ' +
        'code that still reads as authoritative.',
    ).toBeLessThanOrEqual(25);
  });
});
