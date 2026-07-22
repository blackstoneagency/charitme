import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260722150000_auth_marketing_contact_bootstrap.sql'),
  'utf8',
);

describe('auth onboarding migration', () => {
  it('keeps new auth users linked to profiles and marketing contacts', () => {
    expect(migration).toContain('create or replace function public.handle_new_user()');
    expect(migration).toContain('create trigger on_auth_user_created');
    expect(migration).toContain('insert into public.profiles');
    expect(migration).toContain('insert into public.marketing_contacts');
    expect(migration).toContain('on conflict do nothing');
  });

  it('repairs pre-existing auth users idempotently', () => {
    expect(migration).toContain('where not exists (select 1 from public.profiles p where p.id = u.id)');
    expect(migration).toContain('where u.email is not null');
    expect(migration).toContain('where lower(c.email) = lower(u.email)');
  });
});
