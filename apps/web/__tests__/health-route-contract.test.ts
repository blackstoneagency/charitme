import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HEALTH_ROUTE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/api/health/route.ts');

describe('health endpoint contract', () => {
  const source = readFileSync(HEALTH_ROUTE, 'utf8');

  it('keeps public health responses minimal', () => {
    expect(source).toContain("if (!details) return NextResponse.json({ status: 'ok', ts: Date.now() });");
    expect(source).toContain("const user = await verifyAdmin();");
    expect(source).toContain("code: 'ADMIN_REQUIRED'");
  });

  it('only exposes detailed diagnostics through the explicit details flag', () => {
    expect(source).toContain("searchParams.get('details') === '1'");
  });
});
