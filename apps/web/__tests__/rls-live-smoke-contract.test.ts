import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), '../../scripts/rls-live-smoke.mjs'),
  'utf8',
);

describe('live RLS smoke contract', () => {
  it('can mint fresh staging sessions instead of relying on expiring tokens', () => {
    expect(source).toContain('client.auth.signInWithPassword');
    expect(source).toContain('email: persona.email');
    expect(source).toContain('password: persona.password');
  });

  it('verifies credentials belong to the expected user', () => {
    expect(source).toContain('data.user.id !== persona.userId');
    expect(source).toContain('credentials resolved to an unexpected user');
    expect(source).not.toContain('PASS ${persona.name}');
    expect(source).not.toContain('`${persona.name}:');
  });

  it('can require two personas for cross-user isolation', () => {
    expect(source).toContain(
      "process.env.REQUIRE_AUTHENTICATED_RLS_PERSONAS === 'true'",
    );
    expect(source).toContain('personas.length < 2');
  });
});
