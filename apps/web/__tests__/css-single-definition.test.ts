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
    //
    // ⚠️ The first version of this check was INERT and passed against a
    // stylesheet that violated it. It built the pattern as
    // `` `\\${cls.replace('.', '\\.')}...` `` — where `\\` is an escaped
    // backslash, so the regex source began `\\.kf-primary`: a literal backslash
    // followed by any character, which no CSS contains. It reported success on
    // a `.kf-primary` rule that was carrying its own violet gradient at the
    // time. `replace('.', ...)` also escaped only the FIRST dot, so
    // `.pub-btn.primary` would have matched `pub-btnXprimary` had it run at all.
    // Escape with a function, and mutation-test any guard whose whole job is to
    // fail — a green assertion that cannot go red is worse than no assertion,
    // because it is counted as coverage.
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const cls of ['.kind-start', '.kf-primary', '.pub-btn.primary', '.mirror-btn-primary']) {
      const rule = new RegExp(`${esc(cls)}\\s*\\{[^}]*background:\\s*linear-gradient`);
      expect(CODE, `${cls} declares its own gradient instead of using var(--grad-brand)`)
        .not.toMatch(rule);
    }
  });

  it('the CTA-class guard actually fails when a class carries its own gradient', () => {
    // Mutation test for the check above — the one thing that would have caught
    // the inert version. A planted violation must be detected.
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const planted = `${CODE}\n.kf-primary { border: 0; background: linear-gradient(135deg, #6c35ff, #551cf2); }`;
    expect(planted).toMatch(
      new RegExp(`${esc('.kf-primary')}\\s*\\{[^}]*background:\\s*linear-gradient`),
    );
    // …and the multi-class selector must be matched as a literal, not a wildcard.
    expect('.pub-btnXprimary { background: linear-gradient(135deg, #6c35ff, #551cf2); }').not.toMatch(
      new RegExp(`${esc('.pub-btn.primary')}\\s*\\{[^}]*background:\\s*linear-gradient`),
    );
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

    // 28 → 5. Twenty-two rules were routed onto one of two tokens: primary
    // actions onto `--grad-brand`, non-primary violet surfaces (avatars, step
    // numerals, label chips, secondary buttons) onto `--grad-violet`.
    //
    // The five that remain are each deliberate, not drift:
    //   1. the `--grad-violet` token definition itself;
    //   2. `.assistant-icon.grad-2` and 3. `.kf-create-cta-ai` — both pink-ended
    //      and paired with a violet sibling they must stay distinguishable from;
    //   4/5. the two halves of `.contact-mug`, a decorative illustration whose
    //      two sides are supposed to differ.
    //
    // A ratchet, not a target: the number may go DOWN. Raising it means someone
    // hand-wrote a twenty-third violet ramp instead of using a token.
    expect(
      ctaLike.length,
      `violet→violet gradients found: ${ctaLike.length}\n${ctaLike.map((m) => m[0]).join('\n')}\n` +
        'Primary action? use var(--grad-brand). Any other violet surface? ' +
        'var(--grad-violet). Never raise this ceiling — lower it.',
    ).toBeLessThanOrEqual(5);
  });
});

describe('the type scale has three sizes, not six', () => {
  it('defines the scale tokens', () => {
    for (const t of ['--fs-hero', '--fs-h1', '--fs-h2']) {
      expect(CODE, `${t} is missing`).toMatch(new RegExp(`${t}:\\s*clamp\\(`));
    }
  });

  it('does not grow a fourth heading-sized clamp', () => {
    // Measured across the four design families at 1280px: h1 ran 36→86px and h2
    // ran 21→48px. Six unrelated scales, not one. Anything clamping into
    // heading territory (max ≥ 24px) that is not one of the three tokens is a
    // seventh scale starting up.
    //
    // 9 survive, and none is a section heading:
    //   · display numerals — .mirror-metric-grid dd, .about-stat-num,
    //     .about-impact-num, .home-metrics dd
    //   · pull quotes — .about-manifesto-quote, .about-testimonial-quote
    //   · a form question — .cr2-step-q
    //   · two MOBILE overrides inside @media that deliberately shrink a hero
    //     below the token floor (.mirror-hero h1, .about-hero-h1)
    //
    // Attribute before exempting: three entries that looked like decoration on
    // this list — `.kind-hero h1`, `.home-hero h1`, `.cr2-launch-header h2` —
    // turned out to be real headings that had escaped, and were routed.
    const heading = [...CODE.matchAll(/font-size:\s*clamp\(\s*[\d.]+px\s*,[^,]+,\s*(\d+)px\s*\)/g)]
      .filter((m) => Number(m[1]) >= 24);

    expect(
      heading.length,
      `heading-sized clamps outside the token set: ${heading.length}\n` +
        heading.map((m) => m[0]).join('\n') +
        '\nUse var(--fs-hero) for a full-bleed hero h1, var(--fs-h1) for a page ' +
        'header, var(--fs-h2) for a section heading. Lower this ceiling, never raise it.',
    ).toBeLessThanOrEqual(9);
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
    // ⚠️ This used to count a class as duplicated whenever it appeared in two
    // top-level rules, full stop. "Declared twice" is not the defect — plenty of
    // stylesheets legitimately split a class across a token block and a layout
    // block. "Declares the SAME PROPERTY twice, so the earlier one is silently
    // overridden" is the defect. The declarations are now parsed and
    // intersected, which is what the assertion always claimed to measure. The
    // count fell from 26 to 6, i.e. twenty of the flagged classes were never
    // conflicts at all.
    //
    // Worth recording how this was found, because the first diagnosis was wrong.
    // CI went red when master's hero-rotator work added a second `.mirror-home`
    // rule. Reading five lines of each rule showed one declaring `--mh-*` tokens
    // and the other `--h-*` tokens, so I called it a false positive and set out
    // to "fix" the guard. Intersecting the full blocks showed they also both
    // declare `background` and `color` — a real override, real dead code. The
    // guard was right and the five-line read was wrong. Precision here came from
    // measuring the whole rule, not from trusting the first explanation that fit.
    const rules = new Map<string, Set<string>[]>();
    const lines = CODE.split('\n');
    let depth = 0;
    let inAtRule = 0;
    let pending: string[] = [];
    let buffer: string[] = [];

    const propsOf = (body: string) =>
      new Set(
        body
          .split(';')
          .map((d) => d.split(':')[0].trim())
          .filter((p) => /^[-a-z]+$/.test(p)),
      );

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (/^@(media|supports)/.test(trimmed)) inAtRule += 1;
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;

      if (depth === 0 && inAtRule === 0 && opens > 0 && !trimmed.startsWith('@')) {
        pending = trimmed
          .split('{')[0]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /^\.[a-z][a-z0-9-]*$/.test(s));
        buffer = [trimmed.slice(trimmed.indexOf('{') + 1)];
      } else if (depth > 0 && pending.length) {
        buffer.push(line);
      }

      depth += opens - closes;

      if (depth === 0 && pending.length) {
        const props = propsOf(buffer.join('\n').replace(/\}/g, ''));
        for (const sel of pending) rules.set(sel, [...(rules.get(sel) ?? []), props]);
        pending = [];
        buffer = [];
      }
      if (inAtRule > 0 && depth === 0) inAtRule = 0;
    });

    // A real conflict: some property is declared by two different rules for the
    // same class, so whichever loses is dead code that still reads as authoritative.
    const multi = [...rules.entries()]
      .filter(([, blocks]) =>
        blocks.some((a, i) => blocks.slice(i + 1).some((b) => [...a].some((p) => b.has(p)))),
      )
      .map(([sel]) => sel)
      .sort();

    expect(
      multi.length,
      `classes whose rules overwrite each other's properties:\n  ${multi.join(', ')}\n` +
        'Two top-level rules declaring the same property for one class means the ' +
        'earlier declaration is dead code that still reads as authoritative.',
    ).toBeLessThanOrEqual(6);
  });

  it('the conflict detector separates a real override from a harmless split', () => {
    // Mutation test. Without this, the rewrite above could have shipped a
    // detector that finds nothing and still shows green — which is exactly the
    // failure mode the CTA guard in this file already had once.
    const overlap = (a: string, b: string) => {
      const props = (s: string) =>
        new Set(
          s
            .slice(s.indexOf('{') + 1, s.lastIndexOf('}'))
            .split(';')
            .map((d) => d.split(':')[0].trim())
            .filter((p) => /^[-a-z]+$/.test(p)),
        );
      const [pa, pb] = [props(a), props(b)];
      return [...pa].some((p) => pb.has(p));
    };

    // Same property declared twice → a real override.
    expect(overlap('.x { color: red; padding: 2px; }', '.x { color: blue; }')).toBe(true);
    // Disjoint declarations → not a conflict, must NOT be flagged.
    expect(overlap('.x { --token-a: 1; }', '.x { --token-b: 2; }')).toBe(false);
    expect(overlap('.x { color: red; }', '.x { padding: 2px; }')).toBe(false);
  });
});
