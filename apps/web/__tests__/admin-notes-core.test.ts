import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NOTE_TARGET_TYPES,
  isNoteTargetType,
  isValidNoteBody,
  sortNotes,
  visibleNotes,
  notePreview,
  NOTE_MAX_LENGTH,
} from '../lib/admin-notes-core';

describe('target vocabulary agrees with the database', () => {
  it('matches the CHECK constraint in the schema mirror exactly', () => {
    // The list is duplicated in TypeScript on purpose — an insert with a value
    // outside it fails at the constraint with a message no admin can act on. A
    // duplicated list that DRIFTS is worse than no list, so it is diffed here
    // against the schema rather than trusted.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    // [\s\S] rather than the /s flag — the tsconfig target predates it.
    const match = /admin_notes_target_type_check CHECK \(\(target_type = ANY \(ARRAY\[([\s\S]*?)\]\)\)\)/.exec(schema);
    expect(match, 'the CHECK constraint moved or was renamed').toBeTruthy();
    const fromSchema = [...(match![1].matchAll(/'([a-z_]+)'::text/g))].map((m) => m[1]).sort();
    expect(fromSchema).toEqual([...NOTE_TARGET_TYPES].sort());
  });

  it('accepts only those values', () => {
    expect(isNoteTargetType('campaign')).toBe(true);
    expect(isNoteTargetType('user')).toBe(true);
    expect(isNoteTargetType('invoice')).toBe(false);
    expect(isNoteTargetType('')).toBe(false);
    expect(isNoteTargetType(null)).toBe(false);
    expect(isNoteTargetType(7)).toBe(false);
  });
});

describe('isValidNoteBody', () => {
  it('rejects empty and whitespace-only', () => {
    expect(isValidNoteBody('')).toBe(false);
    expect(isValidNoteBody('   \n\t ')).toBe(false);
    expect(isValidNoteBody('ok')).toBe(true);
  });

  it('rejects a body past the limit', () => {
    expect(isValidNoteBody('x'.repeat(NOTE_MAX_LENGTH))).toBe(true);
    expect(isValidNoteBody('x'.repeat(NOTE_MAX_LENGTH + 1))).toBe(false);
  });
});

describe('sortNotes', () => {
  const note = (id: string, pinned: boolean, created_at: string) => ({ id, pinned, created_at });

  it('puts pinned notes first regardless of age', () => {
    // The whole reason the column exists: "this donor is in a chargeback
    // dispute, do not refund" must not be buried under twenty routine notes.
    const rows = [
      note('new', false, '2026-08-02T00:00:00Z'),
      note('old-pinned', true, '2025-01-01T00:00:00Z'),
      note('mid', false, '2026-05-01T00:00:00Z'),
    ];
    expect(sortNotes(rows).map((n) => n.id)).toEqual(['old-pinned', 'new', 'mid']);
  });

  it('orders newest first within each group', () => {
    const rows = [
      note('a', true, '2026-01-01T00:00:00Z'),
      note('b', true, '2026-06-01T00:00:00Z'),
    ];
    expect(sortNotes(rows).map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('does not mutate its input', () => {
    const rows = [note('a', false, '2026-01-01T00:00:00Z'), note('b', true, '2026-01-02T00:00:00Z')];
    sortNotes(rows);
    expect(rows.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('visibleNotes', () => {
  const rows = [
    { id: 'i', internal: true },
    { id: 'p', internal: false },
  ];

  it('shows everything to an admin', () => {
    expect(visibleNotes(rows, 'admin').map((n) => n.id)).toEqual(['i', 'p']);
  });

  it('hides internal notes from the subject of the case', () => {
    // The failure that matters: an internal moderation note reaching the person
    // being moderated. `internal` defaults to true in the database and this
    // defaults to hiding, so the safe direction is the default in both places.
    expect(visibleNotes(rows, 'subject').map((n) => n.id)).toEqual(['p']);
  });

  it('returns a copy, not the original array', () => {
    const out = visibleNotes(rows, 'admin');
    expect(out).not.toBe(rows);
  });
});

describe('notePreview', () => {
  it('flattens newlines so a list stays one line per note', () => {
    expect(notePreview('line one\n\nline two')).toBe('line one line two');
  });

  it('appends an ellipsis only when it actually truncated', () => {
    // Appending unconditionally implies there is more to read when there is not.
    expect(notePreview('short', 100)).toBe('short');
    expect(notePreview('x'.repeat(200), 10)).toBe(`${'x'.repeat(10)}…`);
  });

  it('does not leave a space before the ellipsis', () => {
    expect(notePreview('aaaa bbbb cccc', 5)).toBe('aaaa…');
  });
});
