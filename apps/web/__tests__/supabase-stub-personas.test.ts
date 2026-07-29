import { describe, expect, it } from 'vitest';
import { ASSIGNABLE_ROLES, parseRoles } from '../lib/roles-shared';
import { buildFixtures, STUB_PERSONAS } from '../scripts/supabase-stub-fixtures.mjs';

describe('signed-in audit personas', () => {
  it('defines one independent session for every supported role', () => {
    expect(STUB_PERSONAS.map((persona) => persona.key)).toEqual(ASSIGNABLE_ROLES);
    expect(new Set(STUB_PERSONAS.map((persona) => persona.id)).size).toBe(ASSIGNABLE_ROLES.length);
    expect(new Set(STUB_PERSONAS.map((persona) => persona.token)).size).toBe(ASSIGNABLE_ROLES.length);
    expect(new Set(STUB_PERSONAS.map((persona) => persona.email)).size).toBe(ASSIGNABLE_ROLES.length);
  });

  it('stores each session role set in its matching profile fixture', () => {
    const fixtures = buildFixtures();
    for (const persona of STUB_PERSONAS) {
      const profile = fixtures.profiles.find((candidate) => candidate.id === persona.id);
      expect(profile, `${persona.key} profile`).toBeDefined();
      expect(profile?.roles, `${persona.key} roles`).toEqual(persona.roles);
      expect(fixtures._personas.find((candidate) => candidate.token === persona.token)?.user.id)
        .toBe(persona.id);
    }
  });

  it('uses only roles the production parser accepts', () => {
    for (const persona of STUB_PERSONAS) {
      expect(parseRoles(persona.roles)).toEqual(persona.roles);
    }
  });

  it('keeps the legacy audit token mapped to the super-admin session', () => {
    const fixtures = buildFixtures();
    expect(fixtures._access_token).toBe('stub-access-token');
    expect(fixtures._user.id).toBe(STUB_PERSONAS.find((persona) => persona.key === 'super_admin')?.id);
  });
});
