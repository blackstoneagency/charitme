import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Server-secret leak guard.
//
// Anything in a `'use client'` module is compiled into the browser bundle. If a
// server-only secret is ever read there, it ships to every visitor. Next.js only
// inlines `NEXT_PUBLIC_*` vars, so a non-public `process.env.X` in client code
// evaluates to undefined at runtime — the bug is silent, which is exactly why a
// test is worth having.
//
// Note this polices `process.env.<SECRET>` ACCESS, not the mere mention of a
// variable name: admin setup UI legitimately renders strings like
// "Add SUPABASE_ACCESS_TOKEN to Vercel", and an error message may name the var
// an operator has to set. Those are copy, not leaks.
// ─────────────────────────────────────────────────────────────────────────────

const ROOTS = ['app', 'components', 'lib'].map((d) => join(__dirname, '..', d));

const SERVER_ONLY_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ACCESS_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'CRON_SECRET',
];

// `process.env.FOO` or `process.env['FOO']` — actual reads only.
const secretAccess = (name: string) =>
  new RegExp(String.raw`process\.env\s*(?:\.\s*${name}\b|\[\s*['"\`]${name}['"\`]\s*\])`);

// Repo-relative path for readable failure output.
const rel = (f: string) => f.slice(f.lastIndexOf(`${'/'}app${'/'}`) + 1) || f;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

function isClientModule(src: string): boolean {
  // The directive must be the first statement (ignoring comments/blank lines).
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*|\n)*['"]use client['"]/.test(src);
}

describe('server secrets never reach the client bundle', () => {
  const files = ROOTS.flatMap(walk);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no 'use client' module reads a server-only secret", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (!isClientModule(src)) continue;
      for (const name of SERVER_ONLY_SECRETS) {
        if (secretAccess(name).test(src)) {
          offenders.push(`${rel(f)} → reads ${name}`);
        }
      }
    }
    expect(
      offenders,
      `A client module reads a server-only secret — it would be bundled to the browser:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no server-only secret is exposed through a NEXT_PUBLIC_ alias', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // e.g. NEXT_PUBLIC_FOO: process.env.STRIPE_SECRET_KEY
      for (const name of SERVER_ONLY_SECRETS) {
        const re = new RegExp(String.raw`NEXT_PUBLIC_[A-Z0-9_]+\s*[:=]\s*process\.env\s*\.\s*${name}\b`);
        if (re.test(src)) offenders.push(`${rel(f)} → NEXT_PUBLIC_* aliases ${name}`);
      }
    }
    expect(
      offenders,
      `A server secret is aliased onto a NEXT_PUBLIC_ var (browser-visible):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
