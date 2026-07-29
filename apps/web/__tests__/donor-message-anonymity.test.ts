import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('donor message anonymity', () => {
  it('honors both legacy and migration-native anonymity columns on every reader', () => {
    const route = read('app/api/campaigns/[id]/messages/route.ts');
    const page = read('app/campaigns/[slug]/page.tsx');
    for (const source of [route, page]) {
      expect(source).toContain("'id, message, anonymous, visibility, created_at");
      expect(source).toContain("anonymous ||");
      expect(source).toContain("visibility === 'anonymous'");
    }
  });

  it('removes the profile link from newly anonymous comments', () => {
    const route = read('app/api/campaigns/[id]/messages/route.ts');
    expect(route).toContain('donor_id: isAnonymous ? null : user.id');
    expect(route).toContain('anonymous: isAnonymous');
    expect(route).toContain("visibility: isAnonymous ? 'anonymous' : 'public'");
  });

  it('durably rate limits comment writes', () => {
    const route = read('app/api/campaigns/[id]/messages/route.ts');
    expect(route).toContain('await checkRateLimitDurable(`donor-message:${user.id}`');
    expect(route).toContain("code: 'RATE_LIMITED'");
  });

  it('reconciles production drift without weakening historical privacy', () => {
    const migration = read('../../supabase/migrations/20260813000000_donor_message_anonymity_contract.sql');
    const rollback = read('../../supabase/rollbacks/20260813000000_rollback_donor_message_anonymity_contract.sql');
    expect(migration).toContain('add column if not exists anonymous boolean not null default false');
    expect(migration).toMatch(/where anonymous\s+or visibility = 'anonymous'/);
    expect(migration).toContain('create trigger donor_messages_sync_anonymity');
    expect(rollback).not.toContain('drop column');
  });
});
