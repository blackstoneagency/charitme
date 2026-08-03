import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isPubliclyVisible,
  visibleUpdates,
  publicDate,
  sortForFeed,
  applyFilter,
  excerpt,
  type CampaignUpdateRow,
} from '../lib/campaign-updates-core';

const row = (over: Partial<CampaignUpdateRow>): CampaignUpdateRow => ({
  id: 'u1', title: 'Update', body: 'Body', created_at: '2026-01-01T00:00:00Z', ...over,
});
const NOW = new Date('2026-06-01T12:00:00Z');

describe('public visibility — the security surface of the updates feed', () => {
  it('shows a published update', () => {
    expect(isPubliclyVisible(row({ published_at: '2026-05-01T00:00:00Z' }), NOW)).toBe(true);
  });

  it('shows a scheduled update once its time has passed', () => {
    expect(isPubliclyVisible(row({ scheduled_at: '2026-05-31T00:00:00Z' }), NOW)).toBe(true);
  });

  it('HIDES an update scheduled for the future', () => {
    // The leak this exists to prevent: an organiser schedules an announcement for
    // next week and a stranger reads it today.
    expect(isPubliclyVisible(row({ scheduled_at: '2026-07-01T00:00:00Z' }), NOW)).toBe(false);
  });

  it('HIDES a draft — neither published nor scheduled', () => {
    expect(isPubliclyVisible(row({}), NOW)).toBe(false);
    expect(isPubliclyVisible(row({ published_at: null, scheduled_at: null }), NOW)).toBe(false);
  });

  it('filters a mixed list down to only the visible ones', () => {
    const mixed = [
      row({ id: 'published', published_at: '2026-05-01T00:00:00Z' }),
      row({ id: 'draft' }),
      row({ id: 'future', scheduled_at: '2026-09-01T00:00:00Z' }),
      row({ id: 'past-schedule', scheduled_at: '2026-02-01T00:00:00Z' }),
    ];
    expect(visibleUpdates(mixed, NOW).map((u) => u.id)).toEqual(['published', 'past-schedule']);
  });

  it('treats an exactly-now schedule as visible, not pending', () => {
    expect(isPubliclyVisible(row({ scheduled_at: NOW.toISOString() }), NOW)).toBe(true);
  });
});

describe('the date a reader sees', () => {
  it('prefers published_at over created_at', () => {
    // created_at is when the row was WRITTEN. For a scheduled post that can be
    // weeks earlier, which makes a fresh announcement look stale on the day it
    // goes live.
    expect(publicDate(row({ created_at: '2026-01-01T00:00:00Z', published_at: '2026-05-20T00:00:00Z' })))
      .toBe('2026-05-20T00:00:00Z');
  });

  it('falls back to scheduled_at, then created_at', () => {
    expect(publicDate(row({ created_at: '2026-01-01T00:00:00Z', scheduled_at: '2026-03-01T00:00:00Z' })))
      .toBe('2026-03-01T00:00:00Z');
    expect(publicDate(row({ created_at: '2026-01-01T00:00:00Z' }))).toBe('2026-01-01T00:00:00Z');
  });

  it('sorts the feed by the reader-visible date, not insertion order', () => {
    const rows = [
      row({ id: 'written-first-published-last', created_at: '2026-01-01T00:00:00Z', published_at: '2026-06-01T00:00:00Z' }),
      row({ id: 'written-last-published-first', created_at: '2026-05-01T00:00:00Z', published_at: '2026-05-02T00:00:00Z' }),
    ];
    expect(sortForFeed(rows).map((u) => u.id)).toEqual(['written-first-published-last', 'written-last-published-first']);
  });
});

describe('filters', () => {
  const rows = [
    row({ id: 'recent', title: 'Weekly note', published_at: '2026-05-25T00:00:00Z' }),
    row({ id: 'old', title: 'Kickoff', published_at: '2026-01-05T00:00:00Z' }),
    row({ id: 'milestone', title: 'Goal reached!', published_at: '2026-02-05T00:00:00Z' }),
  ];

  it('“all” returns everything and does not mutate the input', () => {
    const before = rows.map((r) => r.id);
    expect(applyFilter(rows, 'all', NOW)).toHaveLength(3);
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  it('“recent” is the last 30 days by the reader-visible date', () => {
    expect(applyFilter(rows, 'recent', NOW).map((u) => u.id)).toEqual(['recent']);
  });

  it('“milestones” matches the words organisers actually use', () => {
    expect(applyFilter(rows, 'milestones', NOW).map((u) => u.id)).toEqual(['milestone']);
  });
});

describe('excerpt', () => {
  it('leaves short text alone', () => {
    expect(excerpt('Short note.')).toBe('Short note.');
  });

  it('cuts on a word boundary and marks the truncation', () => {
    const long = `${'word '.repeat(100)}end`;
    const out = excerpt(long, 50);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out).not.toMatch(/wor…$/); // not cut mid-word
  });

  it('handles a null body without throwing', () => {
    expect(excerpt(null)).toBe('');
  });
});

describe('the detail page wiring this page fixes', () => {
  const src = readFileSync(resolve(__dirname, '..', 'app/campaigns/[slug]/(detail)/page.tsx'), 'utf8');

  it('the Updates tab links to the feed instead of the co-organisers anchor', () => {
    // It used to be href="#updates", and `id="updates"` sat on the co-organisers
    // block — so the tab scrolled to the wrong section on every campaign page.
    expect(src).toContain('/updates`}>Updates (');
    expect(src).not.toContain('<a href="#updates">');
  });

  it('no element still claims the #updates id', () => {
    expect(src).not.toContain('id="updates"');
  });

  it('the tab count is an exact count, not the capped sidebar query length', () => {
    // getUpdates() has .limit(4), so `updates.length` advertised "Updates (4)"
    // for a campaign with twenty of them.
    expect(src).toContain('getUpdatesCount');
    expect(src).toContain('updatesCount ?? updates.length');
  });
});
