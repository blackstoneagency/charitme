import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(process.cwd(), '../../supabase/migrations');

function withoutLineComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

describe('pending migration policy replay safety', () => {
  it('drops each policy before recreating it', () => {
    const missingDrops: string[] = [];
    const files = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith('.sql') && file >= '20260809000000')
      .sort();

    for (const file of files) {
      const sql = withoutLineComments(readFileSync(join(migrationsDirectory, file), 'utf8'));
      for (const match of sql.matchAll(/^\s*create\s+policy\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))/gim)) {
        const policy = match[1] ?? match[2];
        const escaped = policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const drop = new RegExp(
          `drop\\s+policy\\s+if\\s+exists\\s+(?:"${escaped}"|${escaped})\\s+on`,
          'i',
        );
        if (!drop.test(sql)) missingDrops.push(`${file}: ${policy}`);
      }
    }

    expect(missingDrops).toEqual([]);
  });
});
