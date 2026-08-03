import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// CI skips narrative-markdown-only changes, and that skip must stay NARROW.
//
// Why the skip exists: this repository is private, so Actions minutes are a
// finite monthly allowance. Exhausting it is the most likely cause of the runner
// outages recorded in CLAUDE.md — jobs created, no runner assigned, 0 billable
// ms, no steps. Measured here: 5 of the last 15 commits changed only narrative
// markdown, and each ran the full ~9-minute matrix twice (PR + merge).
//
// Why it must stay narrow: `'**.md'` is the obvious simplification and it is
// WRONG. `AI/employees/*.md` and `AI/sprints/*.md` are compiled into
// `lib/ai-roster.generated.ts` by `prebuild`, and `ai-control-center.test.ts`
// fails when the committed output drifts. Ignoring all markdown would skip CI on
// a markdown change that genuinely breaks the build — a silent hole in the one
// signal that catches it.
//
// So: every ignored pattern must be a file that no build step reads.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, '..', '..', '..');
const CI = join(ROOT, '.github', 'workflows', 'ci.yml');

/**
 * Read the ignore list without a YAML parser.
 *
 * `js-yaml` is only a transitive dependency here and ships no types, so pulling
 * it in for one list would add a devDependency and a types package to guard a
 * twelve-line block. The block is a flat list of quoted strings; this reads it
 * directly.
 */
function ignoreList(src: string): string[] {
  const at = src.indexOf('paths-ignore:');
  if (at === -1) return [];
  const out: string[] = [];
  for (const line of src.slice(at).split('\n').slice(1)) {
    const m = line.match(/^\s+-\s+'([^']+)'\s*$/);
    if (m) { out.push(m[1]); continue; }
    if (line.trim() === '') continue;
    break; // first non-item line ends the block
  }
  return out;
}

describe('CI paths-ignore stays narrow enough to be safe', () => {
  it('the workflow exists and declares an ignore list', () => {
    expect(existsSync(CI), 'ci.yml must exist for this guard to mean anything').toBe(true);
    expect(ignoreList(readFileSync(CI, 'utf8')).length, 'no paths-ignore found').toBeGreaterThan(0);
  });

  it('push and pull_request share ONE list via a YAML anchor', () => {
    const src = readFileSync(CI, 'utf8');
    // Asserting the anchor rather than comparing two lists: sharing one node
    // makes them incapable of drifting. A PR that skips CI while its merge runs
    // it (or the reverse) burns the minutes anyway and makes the PR's red/green
    // meaningless.
    expect(src, 'the ignore list must be declared once as an anchor').toMatch(/paths-ignore:\s*&docs-only/);
    expect(src, 'the second trigger must alias that anchor, not repeat it').toMatch(/paths-ignore:\s*\*docs-only/);
  });

  it('never ignores anything under AI/, which feeds generated code', () => {
    const patterns = ignoreList(readFileSync(CI, 'utf8'));
    for (const p of patterns) {
      expect(
        p.startsWith('AI/') || p === '**.md' || p === '**/*.md' || p === '*.md',
        `"${p}" can match AI/**/*.md, which compiles into lib/ai-roster.generated.ts and is covered by a test. List the narrative docs explicitly instead.`,
      ).toBe(false);
    }
  });

  it('every ignored root file is one no build step reads', () => {
    const patterns = ignoreList(readFileSync(CI, 'utf8'));
    // Anything a script or test reads by name must NOT be in the ignore list.
    const readByBuild = new Set<string>();
    const scriptsDir = join(__dirname, '..', 'scripts');
    for (const f of readdirSync(scriptsDir)) {
      if (!/\.(mjs|js|ts)$/.test(f)) continue;
      const src = readFileSync(join(scriptsDir, f), 'utf8');
      for (const m of src.matchAll(/['"]([A-Za-z0-9_.-]+\.md)['"]/g)) readByBuild.add(m[1]);
    }
    const collisions = patterns.filter((p) => readByBuild.has(p));
    expect(
      collisions,
      'these files are read by a build script, so a change to them can break the build and must not skip CI',
    ).toEqual([]);
  });

  it('only skips docs — never source, config or lockfiles', () => {
    const patterns = ignoreList(readFileSync(CI, 'utf8'));
    const dangerous = patterns.filter((p) =>
      /\.(ts|tsx|js|mjs|cjs|json|sql|css|ya?ml)$/.test(p) ||
      p.startsWith('apps/') || p.startsWith('packages/') || p.startsWith('supabase/'),
    );
    expect(dangerous, 'a code path in paths-ignore silently disables CI for that code').toEqual([]);
  });
});
