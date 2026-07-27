#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Generate lib/ai-roster.generated.ts from the AI/ documents at the repo root.
//
// AI/employees/*.md and AI/sprints/*.md are the owner-maintained source of truth
// for who the AI employees are and which sprint is current. The AI Control
// Center renders them, so it needs them at request time.
//
// They are BAKED IN at build time rather than read with fs at runtime. The docs
// live outside apps/web, so Next's output file tracing would not ship them to a
// Vercel function — the page would render an empty roster in production while
// working perfectly in dev. A generated module is an ordinary import: it cannot
// go missing, needs no next.config tracing rules, and costs no request-time I/O.
//
// Regenerate with `npm run generate:ai-roster` (build does it automatically).
// A test fails if the committed output has drifted from the documents.
// ─────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const AI_ROOT = join(WEB_ROOT, '..', '..', 'AI');
const OUT = join(WEB_ROOT, 'lib', 'ai-roster.generated.ts');

/** Section bodies keyed by their `## Heading`, plus the `# Title`. */
export function splitSections(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const sections = {};
  let title = '';
  let current = null;
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*\S)\s*$/);
    if (h1) { title = h1[1]; current = null; continue; }
    const h2 = line.match(/^##\s+(.*\S)\s*$/);
    if (h2) { current = h2[1]; sections[current] = []; continue; }
    if (current) sections[current].push(line);
  }
  const out = { title, sections: {} };
  for (const [key, value] of Object.entries(sections)) out.sections[key] = value.join('\n').trim();
  return out;
}

/** `- item` lines of a section body, in order. */
export function bulletList(body) {
  return String(body ?? '')
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*[-*]\s+(.*\S)\s*$/)?.[1])
    .filter((v) => typeof v === 'string' && v.length > 0);
}

/** First non-empty prose line of a section body. */
export function firstParagraph(body) {
  for (const line of String(body ?? '').split(/\r?\n/)) {
    const t = line.trim();
    if (t && !/^[-*]\s/.test(t)) return t;
  }
  return '';
}

export function parseEmployee(id, markdown) {
  const { title, sections } = splitSections(markdown);
  return {
    id,
    name: title || id,
    mission: firstParagraph(sections.Mission),
    responsibilities: bulletList(sections['Primary Responsibilities']),
    inputs: bulletList(sections.Inputs),
    outputs: bulletList(sections.Outputs),
    kpis: bulletList(sections.KPIs),
  };
}

export function parseSprint(fileName, markdown) {
  const { title, sections } = splitSections(markdown);
  const number = Number.parseInt(basename(fileName).match(/(\d+)/)?.[1] ?? '', 10);
  return {
    id: basename(fileName, '.md'),
    number: Number.isFinite(number) ? number : null,
    title: title || basename(fileName, '.md'),
    goals: bulletList(sections.Goals),
    backlog: bulletList(sections.Backlog),
  };
}

function mdFiles(dir) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

/** Read and parse the AI/ documents. Exported so the drift test can re-run it. */
export function collectRoster(aiRoot = AI_ROOT) {
  const employees = mdFiles(join(aiRoot, 'employees')).map((f) =>
    parseEmployee(basename(f, '.md'), readFileSync(join(aiRoot, 'employees', f), 'utf8')),
  );
  const sprints = mdFiles(join(aiRoot, 'sprints')).map((f) =>
    parseSprint(f, readFileSync(join(aiRoot, 'sprints', f), 'utf8')),
  );
  // Highest-numbered sprint is the current one. Unnumbered files never win.
  const currentSprint =
    sprints.filter((s) => s.number !== null).sort((a, b) => b.number - a.number)[0] ?? null;
  return { employees, currentSprint };
}

export function renderModule(roster) {
  return `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source: AI/employees/*.md and AI/sprints/*.md at the repository root.
// Regenerate with \`npm run generate:ai-roster\`; \`npm run build\` does it for you.
// __tests__/ai-control-center.test.ts fails if this drifts from the documents.
//
// Baked in rather than read at runtime because AI/ sits outside apps/web and
// would not be traced into a Vercel serverless function.

export type AiEmployeeDoc = {
  id: string;
  name: string;
  mission: string;
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
  kpis: string[];
};

export type AiSprintDoc = {
  id: string;
  number: number | null;
  title: string;
  goals: string[];
  backlog: string[];
};

export const AI_EMPLOYEE_DOCS: AiEmployeeDoc[] = ${JSON.stringify(roster.employees, null, 2)};

export const AI_CURRENT_SPRINT: AiSprintDoc | null = ${JSON.stringify(roster.currentSprint, null, 2)};
`;
}

// Only write when run directly, so tests can import the parsers safely.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const roster = collectRoster();
  writeFileSync(OUT, renderModule(roster));
  console.log(
    `generate:ai-roster — ${roster.employees.length} employees, sprint ${roster.currentSprint?.title ?? '(none)'} → lib/ai-roster.generated.ts`,
  );
}
