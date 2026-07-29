import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveBase } from '../scripts/lib/audit-base.mjs';

// The audit scripts disagreed on how to take a server URL: five wanted
// `--base <url>`, two wanted a bare positional. Passing the wrong spelling does not
// error — the script falls back to its default port and audits whatever is there,
// or nothing. That misfired three times: once in a documented earlier run, then
// twice in one session (audit-contrast swept :3000 while the build under test was
// on :3100; audit-web-vitals reported "nothing usable on :3000" while :3101 served
// fine). Loud failures every time, but the first guess is always "server is down".

const SCRIPTS = join(__dirname, '..', 'scripts');
const argv = (...args: string[]) => ['node', 'script.mjs', ...args];

describe('audit base-URL resolution', () => {
  it('accepts the --base spelling', () => {
    expect(resolveBase(argv('--base', 'http://a:1'))).toBe('http://a:1');
  });

  it('accepts a bare positional URL', () => {
    expect(resolveBase(argv('http://b:2'))).toBe('http://b:2');
  });

  it('finds a positional URL after a BOOLEAN flag', () => {
    // The reason this matches on URL shape rather than "first non-flag argument":
    // a generic skip-the-flags-value rule would treat `--json` as consuming the
    // URL. These scripts really do have boolean flags (--json, --strict-gradients).
    expect(resolveBase(argv('--json', 'http://c:3'))).toBe('http://c:3');
    expect(resolveBase(argv('--strict-gradients', 'http://c:4'))).toBe('http://c:4');
  });

  it('does not mistake a valued flag argument for the base', () => {
    expect(resolveBase(argv('--only', '/a,/b', 'http://f:6'))).toBe('http://f:6');
  });

  it('prefers --base when both are given', () => {
    expect(resolveBase(argv('--base', 'http://d:4', 'http://e:5'))).toBe('http://d:4');
  });

  it('falls back when no URL is present, and honours a custom default', () => {
    expect(resolveBase(argv('--strict-gradients'))).toBe('http://127.0.0.1:3000');
    expect(resolveBase(argv(), 'http://127.0.0.1:3100')).toBe('http://127.0.0.1:3100');
  });

  it('every audit script resolves its base through the shared helper', () => {
    // Guards the regression directly: a new audit that hand-rolls its own parsing
    // reintroduces exactly the inconsistency this replaced.
    const audits = readdirSync(SCRIPTS).filter((f) => f.startsWith('audit-') && f.endsWith('.mjs'));
    expect(audits.length).toBeGreaterThanOrEqual(6);

    const offenders: string[] = [];
    for (const file of audits) {
      const src = readFileSync(join(SCRIPTS, file), 'utf8');
      // Detect HAND-ROLLED argv parsing, not merely "declares a BASE". The broader
      // heuristic flagged two scripts that legitimately have neither: audit-campaign
      // -images uses BASE for an Unsplash URL constant, and audit-signed-in builds
      // its base from a port it spawns itself. Neither reads a base off argv.
      // Match argv READS specifically. A bare /--base/ also matched
      // audit-signed-in, which spawns its own server on --port and *passes*
      // `--base` down to a child audit — it never reads one.
      const parsesArgv =
        /indexOf\(\s*['"]--base['"]\s*\)/.test(src) ||
        /argOf\(\s*['"]--base['"]/.test(src) ||
        /process\.argv\[2\]/.test(src);
      if (!parsesArgv) continue;
      if (!src.includes('resolveBase(')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
