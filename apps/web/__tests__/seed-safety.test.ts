import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const seed = readFileSync(resolve(process.cwd(), '../../supabase/seed.sql'), 'utf8');

describe('local database seed safety', () => {
  it('uses deterministic synthetic identities that cannot receive email', () => {
    expect(seed).toContain('10000000-0000-4000-8000-000000000001');
    expect(seed).toContain('10000000-0000-4000-8000-000000000002');
    expect(seed).toContain('seed-organizer@charitme.invalid');
    expect(seed).toContain('seed-donor@charitme.invalid');
  });

  it('never promotes an arbitrary existing customer', () => {
    expect(seed).not.toMatch(/select\s+id\s+into\s+v_admin_id\s+from\s+auth\.users/i);
    expect(seed).not.toMatch(/order\s+by\s+created_at\s+asc\s+limit\s+1/i);
  });

  it('keeps sample campaigns within the enforced taxonomy', () => {
    expect(seed).not.toContain("'Disaster Relief'");
    expect(seed).toContain("'Emergency'");
  });
});
