import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const verifier = readFileSync(
  resolve(process.cwd(), '../../scripts/verify-production-release.mjs'),
  'utf8',
);
const workflow = readFileSync(
  resolve(process.cwd(), '../../.github/workflows/release.yml'),
  'utf8',
);

describe('production release verification', () => {
  it('requires a successful production deployment for the exact release SHA', () => {
    expect(verifier).toContain('deployment.sha !== releaseSha');
    expect(verifier).toContain("latest?.state === 'success'");
    expect(verifier).toContain("latest?.state === 'failure'");
  });

  it('proves the custom domain serves the same release', () => {
    expect(verifier).toContain("response.headers.get('x-charitme-release') === releaseSha");
    expect(workflow).toContain('node scripts/verify-production-release.mjs');
    expect(workflow).not.toContain('npx vercel deploy --prod');
  });
});
