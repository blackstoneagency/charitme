import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20260903000000_first_party_subject_covers.sql'),
  'utf8',
);
const rollback = readFileSync(
  resolve(process.cwd(), '../../supabase/rollbacks/20260903000000_rollback_first_party_subject_covers.sql'),
  'utf8',
);

describe('first-party subject cover migration', () => {
  it('replaces only empty or known generic campaign placeholders', () => {
    expect(migration).toContain("cover_image_url ilike '%picsum.photos%'");
    expect(migration).toContain("cover_image_url ilike '%loremflickr.com%'");
    expect(migration).not.toMatch(/update public\.campaigns[\s\S]*where\s+true/i);
  });

  it('uses URL-safe categories and unique namespaced keys', () => {
    expect(migration).toContain("'&', '%26'");
    expect(migration).toContain("' ', '%20'");
    expect(migration).toContain("'&key=migration-20260903-'");
    expect(migration).toContain("'-media-' || media.id::text");
  });

  it('rolls back only URLs created by this migration', () => {
    expect(rollback).toContain('&key=migration-20260903-%');
    expect(rollback).not.toContain("&key=%';");
    expect(rollback).not.toMatch(/truncate|delete\s+from/i);
  });
});
