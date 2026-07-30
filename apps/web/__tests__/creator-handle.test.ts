import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { handleError, RESERVED_HANDLES, HANDLE_RE } from '../lib/creator-handle';

// A creator handle becomes a permanent public URL (`/creators/<handle>`) in the
// same namespace as the app's own route segments, and it is UNIQUE in the
// database. Both of those make it expensive to get wrong after the fact, so the
// rules are tested rather than assumed.

describe('creator handle policy', () => {
  it('accepts ordinary handles', () => {
    for (const h of ['jordan', 'jordan-makes', 'jordan_makes', 'a1b', 'x'.repeat(30)]) {
      expect(handleError(h), h).toBeNull();
    }
  });

  it('enforces the 3–30 character bounds', () => {
    expect(handleError('ab')).not.toBeNull();
    expect(handleError('abc')).toBeNull();
    expect(handleError('x'.repeat(30))).toBeNull();
    expect(handleError('x'.repeat(31))).not.toBeNull();
  });

  it('rejects a leading or trailing separator', () => {
    // Not cosmetic: `jordan` and `jordan-` read as the same name to a person,
    // which is the shape impersonation takes.
    for (const h of ['-jordan', 'jordan-', '_jordan', 'jordan_']) {
      expect(handleError(h), h).not.toBeNull();
    }
  });

  it('rejects characters that would change the URL', () => {
    for (const h of ['jordan/admin', 'jordan.makes', 'jordan makes', 'jordan?x=1', 'jordan%2f']) {
      expect(handleError(h), h).not.toBeNull();
    }
  });

  it('normalises case and surrounding whitespace before judging', () => {
    expect(handleError('  Jordan-Makes  ')).toBeNull();
    // …including for the reserved list, or `Admin` walks straight past it.
    expect(handleError('Admin')).not.toBeNull();
    expect(handleError(' SETTINGS ')).not.toBeNull();
  });

  it('rejects every reserved handle', () => {
    for (const h of RESERVED_HANDLES) expect(handleError(h), h).not.toBeNull();
  });

  it('allows a name that merely contains a reserved word', () => {
    // The reserved list must not become a substring ban — `adminah` is a person.
    expect(handleError('adminah')).toBeNull();
    expect(handleError('teamwork')).toBeNull();
  });

  it('reserves every static segment that /creators could collide with', () => {
    // `/creators/[handle]` is the only child today. If a sibling static route is
    // ever added (`/creators/new`), a creator who already owns that handle would
    // have their page shadowed by it — silently, with no error anywhere.
    const dir = join(__dirname, '..', 'app', 'creators');
    const statics = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('[') && !e.name.startsWith('_'))
      .map((e) => e.name);
    for (const seg of statics) {
      expect(RESERVED_HANDLES.has(seg), `/creators/${seg} exists but "${seg}" is not a reserved handle`).toBe(true);
    }
  });

  it('keeps the route using the shared policy rather than its own copy', () => {
    // The rules lived inline in the route first. A second copy is how the API
    // and any future client-side check drift apart.
    const src = readFileSync(join(__dirname, '..', 'app', 'api', 'creators', 'profile', 'route.ts'), 'utf8');
    expect(src).toContain("from '../../../../lib/creator-handle'");
    expect(src.match(/RESERVED_HANDLES\s*=\s*new Set/)).toBeNull();
    expect(src.match(/HANDLE_RE\s*=\s*\//)).toBeNull();
  });

  it('exports a regex anchored at both ends', () => {
    // An unanchored regex would accept `evil/admin` because it matches inside.
    expect(HANDLE_RE.source.startsWith('^')).toBe(true);
    expect(HANDLE_RE.source.endsWith('$')).toBe(true);
  });
});
