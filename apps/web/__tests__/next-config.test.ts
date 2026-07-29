import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type NextConfigContract = {
  outputFileTracingRoot: string;
};

const requireConfig = createRequire(import.meta.url);

const isNextConfigContract = (value: unknown): value is NextConfigContract =>
  typeof value === 'object' &&
  value !== null &&
  'outputFileTracingRoot' in value &&
  typeof value.outputFileTracingRoot === 'string';

describe('Next.js build configuration', () => {
  it('traces server output from the monorepo instead of a parent lockfile', () => {
    const config: unknown = requireConfig('../next.config.js');
    const repoRoot = resolve(process.cwd(), '..', '..');

    expect(isNextConfigContract(config)).toBe(true);
    if (!isNextConfigContract(config)) return;

    expect(resolve(config.outputFileTracingRoot)).toBe(repoRoot);
  });
});
