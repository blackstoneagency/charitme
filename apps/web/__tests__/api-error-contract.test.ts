import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/api');

function routeFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(fullPath));
    else if (entry.name === 'route.ts') files.push(fullPath);
  }
  return files;
}

describe('API error contract', () => {
  it('does not serialize backend error messages in route responses', () => {
    const leaks: string[] = [];
    for (const file of routeFiles(API_DIR)) {
      const source = readFileSync(file, 'utf8');
      if (/(?:error|details):\s*(?:error|err|e|[A-Za-z]+Result)\.message/u.test(source)) {
        leaks.push(path.relative(API_DIR, file).replaceAll('\\', '/'));
      }
      if (/checks\.supabase\s*=\s*`error:/u.test(source)) {
        leaks.push(path.relative(API_DIR, file).replaceAll('\\', '/') + ' (health diagnostic)');
      }
      if (/searchParams\.set\(\s*['"]error['"]\s*,\s*(?:error|userError)\??\.message/u.test(source)) {
        leaks.push(path.relative(API_DIR, file).replaceAll('\\', '/') + ' (redirect diagnostic)');
      }
    }
    expect(leaks, `Routes exposing backend error text: ${leaks.join(', ')}`).toEqual([]);
  });
});
