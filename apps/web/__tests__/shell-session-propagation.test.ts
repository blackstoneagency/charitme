import { describe, expect, it } from 'vitest';
import {
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');

function source(path: string): string {
  return readFileSync(join(WEB_ROOT, path), 'utf8');
}

function tsxFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) files.push(...tsxFiles(path));
    else if (entry.endsWith('.tsx')) files.push(path);
  }
  return files;
}

describe('shell session propagation', () => {
  it('provides the resolved session to dashboard and admin client shells', () => {
    for (const layout of ['app/dashboard/layout.tsx', 'app/admin/layout.tsx']) {
      expect(source(layout)).toContain('loadShellSession');
      expect(source(layout)).toContain('<ShellSessionProvider session={session}>');
    }
  });

  it('does not let routed pages bypass the persona-aware shell wrapper', () => {
    const routedFiles = [
      ...tsxFiles(join(WEB_ROOT, 'app', 'dashboard')),
      ...tsxFiles(join(WEB_ROOT, 'app', 'admin')),
    ];
    const bypasses = routedFiles.filter((path) => {
      const content = readFileSync(path, 'utf8');
      return /import\s*\{[^}]*CharitMeShell[^}]*\}\s*from\s*['"][^'"]*components\/CharitMeApp['"]/.test(content);
    });
    expect(bypasses).toEqual([]);
  });

  it('keeps the server shell on the same shared session resolver', () => {
    const serverShell = source('components/CharitMeShellServer.tsx');
    expect(serverShell).toContain("import { loadShellSession } from '../lib/shell-session-server'");
    expect(serverShell).toContain('const session = await loadShellSession()');
  });
});
