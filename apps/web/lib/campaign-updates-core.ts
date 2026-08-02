// ─────────────────────────────────────────────────────────────────────────────
// Pure logic for the public campaign updates feed (composite image page 60).
//
// Kept out of the page component so the VISIBILITY rule is unit-testable without
// rendering a server component. That rule is the whole security surface of this
// page: `campaign_updates` holds drafts and scheduled posts alongside published
// ones, and an organiser who schedules an announcement for next week has a
// reasonable expectation that nobody can read it today.
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignUpdateRow {
  id: string;
  title: string | null;
  body: string | null;
  created_at: string;
  published_at?: string | null;
  scheduled_at?: string | null;
  ai_generated?: boolean | null;
}

/**
 * Is this update readable by the public right now?
 *
 * Published wins outright. Otherwise a scheduled time that has PASSED counts as
 * published — that is how the detail page already behaves, and diverging here
 * would mean the same update appears in the sidebar timeline and 404s on the
 * feed, or worse, the reverse.
 *
 * An update with neither is a DRAFT and is never public. The subtle case is
 * `scheduled_at` in the future: `.or()` in PostgREST with a `lte` on a nullable
 * column is easy to get subtly wrong, so this is asserted independently here.
 */
export function isPubliclyVisible(update: CampaignUpdateRow, now: Date = new Date()): boolean {
  if (update.published_at) return true;
  if (update.scheduled_at) return new Date(update.scheduled_at).getTime() <= now.getTime();
  return false;
}

/** Defence in depth: the query filters, and then so does this. */
export function visibleUpdates(rows: readonly CampaignUpdateRow[], now: Date = new Date()): CampaignUpdateRow[] {
  return rows.filter((u) => isPubliclyVisible(u, now));
}

/**
 * The date a reader should see.
 *
 * `created_at` is when the row was WRITTEN, which for a scheduled post is days
 * or weeks before anyone could read it. Showing that date makes a fresh
 * announcement look stale on the day it goes live.
 */
export function publicDate(update: CampaignUpdateRow): string {
  return update.published_at ?? update.scheduled_at ?? update.created_at;
}

/** Newest first, by the date the reader sees — not by insertion order. */
export function sortForFeed<T extends CampaignUpdateRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => publicDate(b).localeCompare(publicDate(a)));
}

export type UpdateFilter = 'all' | 'recent' | 'milestones';

/**
 * Filters offered by the design's "All Updates" dropdown.
 *
 * Deliberately only three, and every one is computable from data we actually
 * hold. The mock implies categories the table has no column for; inventing a
 * "Milestones" tag that silently matches nothing would give the reader an empty
 * feed and no way to understand why. Here "milestones" matches on the words
 * organisers actually use in titles, and the UI says so.
 */
const MILESTONE_WORDS = /\b(milestone|goal|reached|complete|completed|halfway|funded|thank you|final)\b/i;

export function applyFilter<T extends CampaignUpdateRow>(rows: readonly T[], filter: UpdateFilter, now: Date = new Date()): T[] {
  if (filter === 'milestones') return rows.filter((u) => MILESTONE_WORDS.test(u.title ?? ''));
  if (filter === 'recent') {
    const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    return rows.filter((u) => new Date(publicDate(u)).getTime() >= cutoff);
  }
  return [...rows];
}

/** A short preview for the feed card, cut on a word boundary rather than mid-word. */
export function excerpt(body: string | null, max = 260): string {
  const text = (body ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
