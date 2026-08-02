/**
 * Admin notes: what one moderator leaves for the next.
 *
 * `admin_notes` shipped with a CHECK constraint, a pinned flag, an internal flag
 * and RLS — and nothing read or wrote it. Every trust decision on this platform
 * is made by a person reading a case cold, and the note that explains *why the
 * last person did what they did* is the difference between a consistent review
 * and a coin flip.
 *
 * Pure module: the target vocabulary, ordering, and the redaction rule.
 */

/**
 * Exactly the values the database CHECK allows. Duplicated deliberately and
 * asserted against the schema mirror in the test — an insert with any other
 * value fails at the constraint with a message no admin can act on, so it is
 * better refused here with a readable reason.
 */
export const NOTE_TARGET_TYPES = [
  'user',
  'campaign',
  'donation',
  'payout',
  'refund',
  'dispute',
  'support_case',
  'report',
] as const;

export type NoteTargetType = (typeof NOTE_TARGET_TYPES)[number];

export function isNoteTargetType(value: unknown): value is NoteTargetType {
  return typeof value === 'string' && (NOTE_TARGET_TYPES as readonly string[]).includes(value);
}

export const NOTE_MAX_LENGTH = 4000;

export type AdminNote = Readonly<{
  id: string;
  target_type: string;
  target_id: string;
  body: string;
  internal: boolean;
  pinned: boolean;
  created_at: string;
  author_id: string | null;
}>;

/** Empty or whitespace-only is not a note. */
export function isValidNoteBody(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length > 0 && trimmed.length <= NOTE_MAX_LENGTH;
}

/**
 * Pinned first, then newest.
 *
 * Pinning exists so the one note that must not be missed — "this donor is in a
 * chargeback dispute, do not refund" — stays at the top as the thread grows. A
 * pure date sort buries it under the next twenty routine notes, which defeats
 * the only reason the column is there.
 */
export function sortNotes<T extends { pinned: boolean; created_at: string }>(notes: readonly T[]): T[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

/**
 * Which notes a given audience may see.
 *
 * `internal` defaults to TRUE in the database, and this function defaults to
 * hiding. An internal note leaking to the subject of a moderation case is the
 * failure that matters here, so the safe direction is the default in both
 * places — a note is private unless something explicitly says otherwise.
 */
export function visibleNotes<T extends { internal: boolean }>(
  notes: readonly T[],
  audience: 'admin' | 'subject',
): T[] {
  if (audience === 'admin') return [...notes];
  return notes.filter((n) => !n.internal);
}

/**
 * A short preview for a list view, with newlines flattened.
 *
 * Truncation is by characters and appends an ellipsis only when it actually cut
 * something — appending it unconditionally implies there is more to read when
 * there is not.
 */
export function notePreview(body: string, limit = 120): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit).trimEnd()}…`;
}
