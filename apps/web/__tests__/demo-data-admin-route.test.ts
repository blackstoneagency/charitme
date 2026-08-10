import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const route = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/super/demo-data/route.ts'), 'utf8');
const page = fs.readFileSync(path.join(process.cwd(), 'app/admin/super/demo-data/DemoDataClient.tsx'), 'utf8');

describe('super-admin demo cleanup contract', () => {
  it('requires super-admin auth, durable rate limiting, validation, and audit logging', () => {
    expect(route).toMatch(/guardSuperAdmin\(\)/);
    expect(route).toMatch(/checkRateLimitDurable/);
    expect(route).toMatch(/RequestSchema\.safeParse/);
    expect(route).toMatch(/logSuperAdminAction/);
  });

  it('blocks real payments and only archives already-labeled campaigns', () => {
    expect(route).toMatch(/stripe_payment_intent_id\.not\.is\.null/);
    expect(route).toMatch(/stripe_checkout_session_id\.not\.is\.null/);
    expect(route).toMatch(/DEMO_LABEL_REQUIRED/);
    expect(route).toMatch(/REAL_PAYMENT_LINKED/);
    expect(route).toMatch(/accept_donations: false/);
    expect(route).toMatch(/deleted_at: new Date\(\)\.toISOString\(\)/);
  });

  it('requires explicit confirmation in the operator UI', () => {
    expect(page).toContain('LABEL_DEMO_CONFIRMATION');
    expect(page).toContain('ARCHIVE_DEMO_CONFIRMATION');
    expect(page).toContain('confirmation !== requiredConfirmation');
  });
});
