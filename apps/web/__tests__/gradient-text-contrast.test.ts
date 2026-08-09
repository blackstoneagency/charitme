import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// White text on a gradient, checked against the gradient's WORST stop.
//
// This exists because of a coverage hole, not a styling preference. CI's
// contrast audit runs with `--strict-gradients` and caught two builder buttons
// at 2.77:1 and 2.15:1. A stylesheet scan then found NINETEEN more stops below
// threshold that the audit had never reported — including `.ado-donor-avatar`
// at **1.19:1**, white initials on a near-white gradient end.
//
// The audit was not wrong. It measures rendered pixels, and every one of those
// controls sits behind an interaction it cannot perform: later steps of the
// campaign wizard, a donor panel that opens on click. **A sweep of initial
// renders cannot see a control that only exists after a click**, which is the
// same structural blind spot recorded for the mobile sweeps in todo.md.
//
// ⚠️ I DECLINED to add this test when it would have failed on 19 rules, because
// a guard that starts red is a guard nobody keeps. It is added now, with those
// rules fixed and the count at zero, so it pins the class rather than
// describing a backlog.
//
// It is deliberately NARROW — only rules that declare a gradient background,
// white text and a font-size together, so the WCAG threshold is knowable from
// the rule itself. Anything vaguer would guess, and guessing is what produced
// four rounds of false findings elsewhere in this repo.
// ─────────────────────────────────────────────────────────────────────────────

const css = readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/** WCAG relative luminance. Matches the audit's own maths — verified against
 *  its reported 2.77:1 and 2.15:1 to the second decimal before being trusted. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

type Rule = { selector: string; size: number; weight: number; stops: string[] };

/**
 * Hex stops from EVERY `linear-gradient(...)` in a rule body, balancing
 * parentheses so nested functions (`color-mix()`, `rgba()`) do not truncate the
 * scan and nothing outside the gradient is swept in.
 */
function gradientStops(body: string): string[] {
  const stops: string[] = [];
  let from = 0;
  for (;;) {
    const start = body.indexOf('linear-gradient(', from);
    if (start < 0) break;
    let depth = 0;
    let i = start + 'linear-gradient'.length;
    const open = i;
    for (; i < body.length; i += 1) {
      if (body[i] === '(') depth += 1;
      else if (body[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    for (const m of body.slice(open, i).matchAll(/#[0-9a-fA-F]{3,8}\b/g)) stops.push(m[0]);
    from = i + 1;
  }
  return stops;
}

function gradientTextRules(): Rule[] {
  const out: Rule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = m;
    if (!body.includes('linear-gradient(')) continue;
    if (!/color:\s*(#fff|#ffffff|white)\b/i.test(body)) continue;
    const size = body.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    // No font-size in the rule means the threshold is not knowable here. The
    // runtime audit still covers those; this test does not guess at them.
    if (!size) continue;
    const weight = body.match(/font-weight:\s*(\d+)/);
    out.push({
      selector: selector.trim().split('\n').pop()!.trim(),
      size: Number(size[1]),
      weight: weight ? Number(weight[1]) : 400,
      // ⚠️ Only the stops INSIDE the gradient's own parentheses. Slicing from
      // `linear-gradient(` to the end of the rule swept up the `color: #fff`
      // that follows it, and every rule then "failed" at 1.00:1 against itself —
      // a harness artifact that reads exactly like 17 real defects.
      stops: gradientStops(body),
    });
  }
  return out;
}

const rules = gradientTextRules();

describe('white text on a gradient meets AA at every stop', () => {
  it('finds the rules it is supposed to be checking', () => {
    // Guards the guard. If the selector shapes change and this matches nothing,
    // every assertion below passes vacuously — the exact failure this repo keeps
    // finding in its own tooling.
    expect(rules.length).toBeGreaterThan(15);
    expect(rules.map((r) => r.selector)).toContain('.cr2-ai-banner-btn');
  });

  it.each(rules.map((r) => [r.selector, r] as const))('%s', (_selector, rule) => {
    // WCAG 1.4.3: large text (>=24px, or >=18.66px bold) needs 3:1, else 4.5:1.
    const large = rule.size >= 24 || (rule.size >= 18.66 && rule.weight >= 700);
    const need = large ? 3 : 4.5;
    for (const stop of rule.stops) {
      const ratio = contrastWithWhite(stop);
      expect(
        Number(ratio.toFixed(2)),
        `${rule.selector}: white on ${stop} is ${ratio.toFixed(2)}:1, under the ${need}:1 floor ` +
          `for ${rule.size}px/${rule.weight}. A gradient is scored at its WORST stop — darken ` +
          `this one within its own hue rather than switching to dark text.`,
      ).toBeGreaterThanOrEqual(need);
    }
  });
});
