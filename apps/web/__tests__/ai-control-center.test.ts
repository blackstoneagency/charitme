import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  AI_AGENTS,
  FACTS,
  agentById,
  buildContextPack,
  contextPackToMarkdown,
  formatFactValue,
  resolveAgentStatus,
  statusTone,
  type ContextSource,
  type SourceHealth,
} from '../lib/ai-agents-core';
import {
  countFromPagination,
  deriveOpenIssues,
  parseLastPage,
  parseRepoSlug,
} from '../lib/github-core';

const WEB_ROOT = join(__dirname, '..');
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const read = (p: string) => strip(readFileSync(join(WEB_ROOT, p), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// AI Control Center (/admin/ai) — Phase 1 of the AI Context Manager.
//
// The console reports on delivery and platform state, so the numbers it prints
// are read as facts by whoever opens it. Two properties are load-bearing:
//
//  • A count that could not be read must render as an em dash, never 0. Zero is
//    the reassuring answer for "open issues" and "open risk flags" — the same
//    fail-open shape already fixed in six other places on this platform.
//  • 'Ready' must be derived from measured source health, never asserted.
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CONNECTED: Record<ContextSource, SourceHealth> = {
  github: 'connected',
  supabase: 'connected',
  docs: 'connected',
};

describe('the roster is well formed', () => {
  it('is exactly the AI/employees documents, with nothing invented', () => {
    // The roster must not be a second hardcoded list that drifts from the
    // documents the owner maintains.
    const onDisk = readdirSync(join(WEB_ROOT, '..', '..', 'AI', 'employees'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    expect(AI_AGENTS.map((a) => a.id).sort()).toEqual(onDisk);
  });

  it('includes the five agents the console was specified with', () => {
    const ids = AI_AGENTS.map((a) => a.id);
    for (const id of ['executive-assistant', 'lead-engineer', 'qa-engineer', 'security-engineer', 'marketing-director']) {
      expect(ids, id).toContain(id);
    }
  });

  it('carries each document\'s real mission text, not a placeholder', () => {
    for (const agent of AI_AGENTS) {
      const doc = readFileSync(join(WEB_ROOT, '..', '..', 'AI', 'employees', `${agent.id}.md`), 'utf8');
      expect(doc, agent.id).toContain(agent.mandate);
    }
  });

  it('gives every agent a unique id, a mandate and at least one source', () => {
    const ids = AI_AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const agent of AI_AGENTS) {
      expect(agent.mandate.length, agent.id).toBeGreaterThan(20);
      expect(agent.responsibilities.length, agent.id).toBeGreaterThan(0);
      expect(agent.requires.length, agent.id).toBeGreaterThan(0);
      expect(agent.facts.length, agent.id).toBeGreaterThan(0);
    }
  });

  it('only asks for facts the assembler knows how to read', () => {
    for (const agent of AI_AGENTS) {
      for (const key of agent.facts) {
        expect(FACTS[key], `${agent.id} wants unknown fact ${key}`).toBeDefined();
      }
    }
  });

  it('requires exactly the sources its facts come from', () => {
    // A mismatch is how an agent ends up 'Ready' while a source it actually
    // reads is down. This held by hand-declaration once and immediately broke;
    // `requires` is now derived, so this asserts the derivation.
    for (const agent of AI_AGENTS) {
      const used = new Set(agent.facts.map((k) => FACTS[k].source));
      expect(new Set(agent.requires), agent.id).toEqual(used);
    }
  });

  it('gives an undocumented employee a working default rather than an empty card', () => {
    // Dropping a new markdown file into AI/employees/ must not need a code change.
    for (const agent of AI_AGENTS) {
      expect(agent.facts.length, agent.id).toBeGreaterThan(0);
    }
  });

  it('resolves by id and returns null rather than throwing on a bad one', () => {
    expect(agentById('executive-assistant')?.name).toBe('Executive Assistant');
    expect(agentById('marketing-director')?.name).toBe('Marketing Director');
    expect(agentById('nope')).toBeNull();
    expect(agentById('')).toBeNull();
  });
});

describe('readiness is derived, never asserted', () => {
  it('is Ready only when every required source answered', () => {
    for (const agent of AI_AGENTS) {
      expect(resolveAgentStatus(agent, ALL_CONNECTED), agent.id).toBe('Ready');
    }
  });

  it('degrades when a required source is unreadable', () => {
    const ea = agentById('executive-assistant')!;
    expect(resolveAgentStatus(ea, { ...ALL_CONNECTED, github: 'unreadable' })).toBe('Degraded');
    expect(resolveAgentStatus(ea, { ...ALL_CONNECTED, supabase: 'unreadable' })).toBe('Degraded');
  });

  it('reports Needs setup when a required source has no credentials', () => {
    const ea = agentById('executive-assistant')!;
    expect(resolveAgentStatus(ea, { ...ALL_CONNECTED, github: 'not-configured' })).toBe('Needs setup');
  });

  it('prefers the more actionable answer when both failures are present', () => {
    const ea = agentById('executive-assistant')!;
    expect(resolveAgentStatus(ea, { github: 'not-configured', supabase: 'unreadable' })).toBe('Needs setup');
  });

  it('never treats a missing measurement as healthy', () => {
    // An empty health map means nothing was measured at all.
    for (const agent of AI_AGENTS) {
      expect(resolveAgentStatus(agent, {}), agent.id).not.toBe('Ready');
    }
  });

  it('ignores sources the agent does not depend on', () => {
    // Marketing reads only platform facts, so GitHub being absent is irrelevant.
    const marketing = agentById('marketing-director')!;
    expect(marketing.requires).not.toContain('github');
    expect(resolveAgentStatus(marketing, { github: 'not-configured', supabase: 'connected', docs: 'connected' })).toBe('Ready');
    // Lead Engineer reads no platform facts, so the database being down is not its problem.
    const lead = agentById('lead-engineer')!;
    expect(lead.requires).not.toContain('supabase');
    expect(resolveAgentStatus(lead, { github: 'connected', supabase: 'unreadable', docs: 'connected' })).toBe('Ready');
  });

  it('does not colour an unmeasured status green', () => {
    expect(statusTone('Ready')).toBe('green');
    expect(statusTone('Degraded')).toBe('amber');
    expect(statusTone('Needs setup')).toBe('grey');
  });
});

describe('an unreadable fact is unknown, not zero', () => {
  it('formats null and undefined as unknown', () => {
    expect(formatFactValue(null)).toBeNull();
    expect(formatFactValue(undefined)).toBeNull();
  });

  it('keeps a genuine zero', () => {
    // The whole point: measured 0 and unread must be distinguishable.
    expect(formatFactValue(0)).toBe('0');
  });

  it('rejects a non-finite number rather than printing NaN', () => {
    expect(formatFactValue(Number.NaN)).toBeNull();
    expect(formatFactValue(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('treats a blank string as unknown', () => {
    expect(formatFactValue('   ')).toBeNull();
    expect(formatFactValue('Sprint 12')).toBe('Sprint 12');
  });

  it('groups large counts for readability', () => {
    expect(formatFactValue(1234)).toBe((1234).toLocaleString());
  });
});

describe('the context pack reports its own gaps', () => {
  const lead = agentById('lead-engineer')!;
  const BUILT = '2026-07-27T10:00:00.000Z';

  it('lists every requested fact in order', () => {
    const pack = buildContextPack(lead, { sprint: 'Sprint 12', openIssues: 14, openPullRequests: 5 }, BUILT);
    expect(pack.facts.map((f) => f.key)).toEqual([...lead.facts]);
    expect(pack.facts.map((f) => f.value)).toEqual(['Sprint 12', '14', '5']);
    expect(pack.missing).toEqual([]);
  });

  it('names the facts that could not be read', () => {
    const pack = buildContextPack(lead, { sprint: 'Sprint 12', openIssues: null, openPullRequests: null }, BUILT);
    expect(pack.missing).toEqual(['Open GitHub issues', 'Open pull requests']);
  });

  it('does not count a measured zero as missing', () => {
    const pack = buildContextPack(lead, { sprint: 'Sprint 12', openIssues: 0, openPullRequests: 0 }, BUILT);
    expect(pack.missing).toEqual([]);
  });

  it('carries a missing fact into the markdown instead of dropping it', () => {
    // A fact silently absent from the brief reads to an agent as "no problem
    // there" — the gap has to be stated.
    const md = contextPackToMarkdown(
      buildContextPack(lead, { sprint: 'Sprint 12', openIssues: null, openPullRequests: 5 }, BUILT),
    );
    expect(md).toContain('Open GitHub issues: unknown (read failed)');
    expect(md).toContain('UNKNOWN, not zero');
    expect(md).not.toContain('Open GitHub issues: 0');
  });

  it('omits the gaps section when the pack is complete', () => {
    const md = contextPackToMarkdown(
      buildContextPack(lead, { sprint: 'Sprint 12', openIssues: 14, openPullRequests: 5 }, BUILT),
    );
    expect(md).not.toContain('## Gaps');
    expect(md).toContain('Open GitHub issues: 14');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wiring guards. These assert the shape of the I/O layer that the pure tests
// above cannot reach.
// ─────────────────────────────────────────────────────────────────────────────

describe('a repo slug is validated before it becomes a URL path', () => {
  it('accepts a well-formed owner/name', () => {
    expect(parseRepoSlug('blackstoneagency/charitme')).toBe('blackstoneagency/charitme');
    expect(parseRepoSlug('  owner/repo.js  ')).toBe('owner/repo.js');
  });

  it('rejects anything that is not exactly one slash-separated pair', () => {
    for (const bad of ['', '   ', 'charitme', 'a/b/c', '/repo', 'owner/', 'owner name/repo', null, undefined]) {
      expect(parseRepoSlug(bad), String(bad)).toBeNull();
    }
  });

  it('rejects a slug that would escape the intended path', () => {
    // A slug reaching the URL unvalidated is how `../` or a query string turns a
    // repo read into a different API call.
    expect(parseRepoSlug('../../user')).toBeNull();
    expect(parseRepoSlug('owner/repo?foo=1')).toBeNull();
    expect(parseRepoSlug('owner/repo#x')).toBeNull();
  });
});

describe('counting from pagination', () => {
  it('reads the total from the rel="last" page number', () => {
    const link =
      '<https://api.github.com/repositories/1/pulls?per_page=1&page=2>; rel="next", ' +
      '<https://api.github.com/repositories/1/pulls?per_page=1&page=37>; rel="last"';
    expect(countFromPagination(link, 1)).toBe(37);
  });

  it('falls back to the body length when GitHub omits Link', () => {
    // Verified against the live repo: a single-page result carries no Link
    // header at all, so this is the ordinary case, not an edge case.
    expect(countFromPagination(null, 1)).toBe(1);
    expect(countFromPagination(null, 0)).toBe(0);
  });

  it('is unknown when neither signal is usable', () => {
    expect(countFromPagination(null, null)).toBeNull();
  });

  it('ignores rel values other than last', () => {
    expect(parseLastPage('<https://api.github.com/x?page=9>; rel="next"')).toBeNull();
    expect(parseLastPage('')).toBeNull();
    expect(parseLastPage(null)).toBeNull();
    expect(parseLastPage('garbage')).toBeNull();
  });
});

describe('the issue count subtracts pull requests', () => {
  it('reproduces the live repository exactly', () => {
    // Measured 2026-07-27 against blackstoneagency/charitme: open_issues_count
    // is 1, and the one open item is PR #93. The honest answer is 0 issues.
    expect(deriveOpenIssues(1, 1)).toBe(0);
  });

  it('separates the two numbers the page shows', () => {
    expect(deriveOpenIssues(19, 5)).toBe(14);
  });

  it('is unknown when either side is unknown', () => {
    // A half-known subtraction would print a confident wrong number.
    expect(deriveOpenIssues(null, 5)).toBeNull();
    expect(deriveOpenIssues(19, null)).toBeNull();
    expect(deriveOpenIssues(null, null)).toBeNull();
  });

  it('clamps the read-race to zero rather than going negative', () => {
    expect(deriveOpenIssues(1, 2)).toBe(0);
  });
});

describe('the GitHub client fails closed', () => {
  const src = read('lib/github.ts');

  it('uses only repo-scoped endpoints', () => {
    // The Search API is refused by gateways that bind a token to specific
    // repositories — this project's own sandbox returns 403 for it.
    expect(src).not.toContain('/search/issues');
    for (const path of ['/repos/${repo}`', '/repos/${repo}/pulls']) {
      expect(src, path).toContain(path);
    }
  });

  it('never prints open_issues_count as the issue count', () => {
    // It counts PRs as issues; it is only ever an input to deriveOpenIssues.
    expect(src).toContain('deriveOpenIssues(issuesAndPulls, openPullRequests)');
    expect(src).not.toMatch(/openIssues:\s*(repoRes|issuesAndPulls)/);
  });

  it('returns null counts rather than defaulting to zero', () => {
    expect(src).not.toMatch(/open_issues_count \?\? 0/);
    expect(src).toMatch(/number \| null/);
  });

  it('marks the snapshot unreadable when any leg failed', () => {
    expect(src).toMatch(/failures\.length === 0 \? 'connected' : 'unreadable'/);
  });

  it('does not report connected without a token', () => {
    expect(src).toMatch(/if \(!githubToken\(\)\) return NOT_CONFIGURED/);
  });

  it('bounds the request so a hung call cannot hold the page', () => {
    expect(src).toContain('AbortSignal.timeout');
  });

  it('never echoes a GitHub error body onto an admin screen', () => {
    expect(src).not.toMatch(/res\.text\(\)/);
  });
});

describe('platform counts do not coerce a failed read to zero', () => {
  const src = read('lib/ai-context.ts');

  it('derives every count from the error field', () => {
    expect(src).toMatch(/result\.error \? null : result\.count/);
    expect(src).not.toMatch(/count \?\? 0/);
  });

  it('takes the sprint from the AI documents, not from GitHub', () => {
    // Two competing answers to "which sprint is this?" is worse than one.
    expect(src).toMatch(/sprint: sprint\?\.title \?\? null/);
    expect(read('lib/github.ts')).not.toMatch(/milestone/i);
  });
});

describe('the page and its API are super-admin only', () => {
  const page = read('app/admin/ai/page.tsx');
  const route = read('app/api/admin/ai/context/route.ts');

  it('the page requires a super admin', () => {
    expect(page).toContain('requireSuperAdmin()');
  });

  it('the context API guards before doing any work', () => {
    expect(route).toMatch(/const guard = await guardSuperAdmin\(\);\s*if \(!guard\.ok\) return guard\.response;/);
  });

  it('the API rejects an unknown agent id instead of building something empty', () => {
    expect(route).toMatch(/UNKNOWN_AGENT/);
  });

  it('records the build in the super-admin audit log', () => {
    expect(route).toContain('logSuperAdminAction');
  });
});

describe('AI is reachable from the left navigation', () => {
  const nav = read('components/SuperAdminNav.tsx');
  // The list itself moved to lib/super-admin-nav.ts, a module with no
  // 'use client'. It had to: app/admin/super/page.tsx is a Server Component, and
  // a plain value imported across the client boundary arrives as a reference
  // proxy, so SUPER_ADMIN_NAV.filter threw and that page 500'd. The assertion
  // follows the data; the rendering assertions below still read the component.

  it('appears in the super-admin nav list', () => {
    // The list moved to lib/super-admin-nav.ts, a module with NO 'use client':
    // app/admin/super/page.tsx is a Server Component, and Next replaces a client
    // module with a reference proxy, so plain data does not survive the boundary.
    expect(read('lib/super-admin-nav.ts')).toMatch(/\['AI', '\/admin\/ai', 'spark'\]/);
  });

  it('keeps the list out of the client module, so the server page can read it', () => {
    expect(read('lib/super-admin-nav.ts')).not.toContain("'use client'");
    expect(read('app/admin/super/page.tsx')).toContain("from '../../../lib/super-admin-nav'");
  });

  it('sits in the self-gating super-admin section, not the shared admin nav', () => {
    // components/CharitMeApp.tsx's adminNav renders for every admin; putting the
    // entry there would advertise a page plain admins are redirected away from.
    expect(read('components/CharitMeApp.tsx')).not.toContain("'/admin/ai'");
  });

  it('expands the section from the nav list rather than a path prefix', () => {
    // /admin/ai is outside /admin/super/, so a prefix test left the section
    // collapsed while standing on the page.
    expect(nav).toMatch(/SUPER_ADMIN_NAV\.some\(\(\[, href\]\) =>/);
    expect(nav).not.toMatch(/const onSuper = path === '\/admin\/super' \|\| path\.startsWith\('\/admin\/super\/'\)/);
  });
});

describe('the console renders unknown as an em dash', () => {
  const client = read('app/admin/ai/_components/AiControlCenterClient.tsx');

  it('prints an em dash for a null count', () => {
    expect(client).toMatch(/value === null \? '—'/);
  });

  it('warns the operator when a source is not reporting', () => {
    expect(client).toContain('role="alert"');
    expect(client).toMatch(/it is not zero/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The roster is compiled from AI/*.md at build time rather than read with fs at
// request time: those documents live outside apps/web, so Next's output file
// tracing would not ship them into a Vercel function — the page would render an
// empty roster in production while working perfectly in dev.
//
// The cost of baking them in is that the generated file can go stale. This test
// is what makes that impossible to miss.
// ─────────────────────────────────────────────────────────────────────────────
describe('the generated roster matches the documents on disk', () => {
  it('has not drifted from AI/employees and AI/sprints', async () => {
    const { collectRoster, renderModule } = await import('../scripts/generate-ai-roster.mjs');
    const expected = renderModule(collectRoster());
    const committed = readFileSync(join(WEB_ROOT, 'lib', 'ai-roster.generated.ts'), 'utf8');
    expect(
      committed.replace(/\r\n/g, '\n'),
      'lib/ai-roster.generated.ts is stale — run `npm run generate:ai-roster`',
    ).toBe(expected);
  });

  it('parses a document into the sections the console renders', async () => {
    const { parseEmployee } = await import('../scripts/generate-ai-roster.mjs');
    const parsed = parseEmployee(
      'demo',
      '# Demo Role\n\n## Mission\nDo the thing well.\n\n## Primary Responsibilities\n- One\n- Two\n\n## KPIs\n- Quality\n',
    );
    expect(parsed).toMatchObject({
      id: 'demo',
      name: 'Demo Role',
      mission: 'Do the thing well.',
      responsibilities: ['One', 'Two'],
      kpis: ['Quality'],
    });
  });

  it('picks the highest-numbered sprint as current', async () => {
    const { collectRoster } = await import('../scripts/generate-ai-roster.mjs');
    const { currentSprint } = collectRoster();
    // sprint-001 and sprint-002 both exist; 002 is current.
    expect(currentSprint?.number).toBe(2);
    expect(currentSprint?.title).toBe('Sprint 002');
  });
});
