import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_STEPS } from '../lib/ai-campaign-steps';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

const flow = read('app/create/ai/AiCampaignFlow.tsx');
const page = read('app/create/ai/page.tsx');
const entry = read('app/ai-campaign/page.tsx');
const css = read('app/globals.css');

/**
 * Source with comments removed.
 *
 * Needed because the first version of the two "must not contain" assertions
 * below matched the COMMENTS that explain why those strings are not shipped —
 * so they failed on correct code, and would equally have passed on code that
 * shipped the string with a comment removed. A "not present" assertion has to
 * look at what actually renders.
 */
const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const flowCode = stripComments(flow);
const entryCode = stripComments(entry);

/** The `.aiw` block only — globals.css has six `max-width: 560px` queries. */
const aiwCss = css.slice(css.indexOf('.aiw {'));

// ─────────────────────────────────────────────────────────────────────────────
// Source-level, and the limit is worth naming: this repo cannot render a
// component in a test (`vitest.config.ts` collects `__tests__/**/*.test.ts`, and
// importing a `.tsx` fails to transform under Next's `jsx: 'preserve'`). The
// step DECISIONS are pure and fully executed in `ai-campaign-steps.test.ts`;
// these assert the wiring around them.
// ─────────────────────────────────────────────────────────────────────────────

describe('every step is actually rendered, not just declared', () => {
  it('has a branch for all twelve', () => {
    // A step in the list with no branch renders a blank panel and a Next button
    // — which looks like a loading state that never resolves.
    for (const s of AI_STEPS) {
      expect(flow, `step ${s.number} (${s.id}) has no render branch`)
        .toMatch(new RegExp(`step === '${s.id}'`));
    }
  });

  it('shows the step number rail for all twelve', () => {
    expect(flow).toMatch(/AI_STEPS\.map/);
    expect(flow).toMatch(/aria-label=\{`Step \$\{current\} of \$\{AI_STEPS\.length\}`\}/);
  });
});

describe('the button and the submit cannot disagree', () => {
  it('both read the same gate', () => {
    // A Next button enabled while the handler refuses is indistinguishable from
    // a broken button.
    expect(flow).toMatch(/const gate = useMemo\(\(\) => canAdvance\(step, draft\)/);
    expect(flow).toMatch(/disabled=\{!gate\.ok \|\| busy !== null\}/);
    expect(flow).toMatch(/if \(!canAdvance\(step, draft\)\.ok\) return;/);
  });

  it('tells the user why Next is disabled, and links it to the button', () => {
    // A disabled control with no reason is the most common dead end in a wizard.
    expect(flow).toMatch(/gate\.reason/);
    expect(flow).toMatch(/aria-describedby=\{!gate\.ok && gate\.reason \? 'aiw-gate' : undefined\}/);
  });
});

describe('AI is never load-bearing', () => {
  it('every generating step leaves a manual path open', () => {
    // OPENAI_API_KEY is optional in this product. A wizard that dead-ends
    // without it is not shippable, so a failed generation must be a setback.
    expect(flow).toMatch(/you can write your story yourself below/);
    expect(flow).toMatch(/enter a goal yourself below/);
  });

  it('the story and goal stay editable regardless of generation', () => {
    expect(flow).toMatch(/value=\{draft\.story\} onChange=/);
    expect(flow).toMatch(/onChange=\{\(e\) => set\(\{ goalCents:/);
  });

  it('surfaces failures instead of silently doing nothing', () => {
    expect(flow).toMatch(/role="alert"/);
  });
});

describe('the campaign is created once, at step 8', () => {
  it('posts to the real campaigns API', () => {
    expect(flow).toMatch(/postJson<\{ id: string; slug: string \}>\('\/api\/campaigns'/);
  });

  it('is the only write before the campaign exists', () => {
    // Steps 9-12 are campaign-scoped; any earlier write would need an id that
    // does not exist yet.
    const beforeCreate = flow.slice(0, flow.indexOf('const createCampaign'));
    expect(beforeCreate).not.toMatch(/fetch\('\/api\/(team-members|ai\/content)/);
  });

  it('guards the campaign-scoped calls on the campaign existing', () => {
    expect(flow).toMatch(/const loadCaptions = useCallback\(async \(\) => \{\s*if \(!created\) return;/);
    expect(flow).toMatch(/if \(!created \|\| !teamEmail\.trim\(\)\) return;/);
  });

  it('sends a real category and goal, not placeholders', () => {
    expect(flow).toMatch(/category: draft\.category/);
    expect(flow).toMatch(/goalAmount: draft\.goalCents/);
  });
});

describe('step 7 presents a plan, never an achieved outcome', () => {
  it('says so in the copy', () => {
    // The design draws finished-looking tiles ("2,500+ People Served"). This
    // campaign has raised nothing; presenting those as results is a fabricated
    // outcome, which this repo refuses everywhere else.
    expect(flow).toMatch(/This is your <strong>plan<\/strong> for the money, not a result/);
  });

  it("ships none of the mock's invented result figures", () => {
    for (const invented of ['People Served', '2,500+', 'Healthier Communities', 'Clean Water Wells']) {
      expect(flowCode, `"${invented}" is a result nobody measured`).not.toContain(invented);
    }
  });

  it('states over-allocation plainly rather than hiding it', () => {
    expect(flow).toMatch(/more than your goal/);
  });
});

describe('the flow is reachable, and the entry point carries the prompt', () => {
  it('is auth-gated before any work is done', () => {
    // Walking eight steps and THEN discovering you need an account throws the
    // work away at the worst possible moment.
    expect(page).toMatch(/await requireUser\(\)/);
  });

  it('/ai-campaign sends people to the twelve-step flow', () => {
    expect(entry).toMatch(/\/create\/ai\?cause=/);
    expect(entryCode, 'the old generic-wizard seed must be gone').not.toMatch(/\/create\?ai=/);
  });

  it('/ai-campaign finally reads the ?q= that links have been sending it', () => {
    // /ai-fundraising's chips have always appended ?q=; the page seeded an empty
    // box, so the choice was silently discarded.
    expect(entry).toMatch(/params\.get\('q'\)/);
  });

  it('suspends the search-params read so the route is not de-opted', () => {
    expect(entry).toMatch(/<Suspense fallback=\{null\}>/);
  });

  it('accepts the prompt at the other end', () => {
    expect(page).toMatch(/params\.cause \?\? params\.ai/);
  });
});

describe('the screen works in both themes and on a phone', () => {
  it('styles with tokens only', () => {
    const hardcoded = aiwCss.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    // #fff on a filled brand button is the one literal that is correct in both
    // themes, because the brand surface it sits on is itself a token.
    expect(hardcoded.every((h) => h.toLowerCase() === '#fff'), `hardcoded colours: ${hardcoded}`).toBe(true);
  });

  it('keeps a visible focus ring on every control', () => {
    for (const sel of ['.aiw-btn:focus-visible', '.aiw-chip:focus-visible', '.aiw-cover:focus-visible']) {
      expect(css, `${sel} has no focus ring`).toContain(sel);
    }
    expect(css).toMatch(/\.aiw-panel input:focus-visible[^{]*\{[^}]*outline:/);
  });

  it('reflows the two grid layouts that would otherwise overflow a phone', () => {
    const mq = aiwCss.slice(aiwCss.indexOf('@media (max-width: 560px)'));
    // Both are multi-column grids that would otherwise force a horizontal
    // scroll: the impact editor is `1fr 120px auto`, the review list `110px 1fr`.
    // `minmax(0, 1fr)`, not a bare `1fr` — the repo-wide guard in
    // `globals-grid.test.ts` exists because a bare track grows to its widest
    // child at every width, which is the overflow this reflow is meant to fix.
    expect(mq).toMatch(/\.aiw-impact li \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(mq).toMatch(/\.aiw-review div \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  });
});
