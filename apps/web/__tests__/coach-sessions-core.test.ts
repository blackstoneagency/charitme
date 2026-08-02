import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SESSION_IDLE_MS,
  MESSAGES_PER_EXCHANGE,
  shouldExtendSession,
  nextMessageCount,
  summariseSessions,
  groupByCampaign,
  describeSummary,
  type CoachSessionRow,
} from '../lib/coach-sessions-core';

const row = (over: Partial<CoachSessionRow> = {}): CoachSessionRow => ({
  id: 'a',
  campaign_id: null,
  message_count: 2,
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-01T10:00:00.000Z',
  ...over,
});

describe('the schema this module is written against', () => {
  it('has no coach_messages table — so nothing here may model a transcript', () => {
    // The reader shows counts and times because that is all the database holds.
    // If a transcript table ever lands, this test fails and the comment above
    // stops being true — which is the point.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    expect(schema).toContain('CREATE TABLE public.coach_sessions');
    expect(schema).not.toContain('CREATE TABLE public.coach_messages');
  });

  it('declares exactly the columns this module reads', () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    const match = /CREATE TABLE public\.coach_sessions \(([\s\S]*?)\n\);/.exec(schema);
    expect(match, 'coach_sessions moved or was renamed').toBeTruthy();
    for (const column of ['user_id', 'campaign_id', 'message_count', 'created_at', 'updated_at']) {
      expect(match![1]).toContain(column);
    }
  });
});

describe('shouldExtendSession', () => {
  const now = Date.parse('2026-08-01T10:10:00.000Z');

  it('extends a recent session on the same campaign', () => {
    expect(shouldExtendSession(row({ campaign_id: 'c1' }), 'c1', now)).toBe(true);
  });

  it('starts a new session once the idle window passes', () => {
    const stale = row({ updated_at: new Date(now - SESSION_IDLE_MS - 1).toISOString() });
    expect(shouldExtendSession(stale, null, now)).toBe(false);
    const fresh = row({ updated_at: new Date(now - SESSION_IDLE_MS + 1).toISOString() });
    expect(shouldExtendSession(fresh, null, now)).toBe(true);
  });

  it('starts a new session when the campaign context changes', () => {
    // Advice about a different campaign folded into the previous row would
    // attribute it to the wrong campaign.
    expect(shouldExtendSession(row({ campaign_id: 'c1' }), 'c2', now)).toBe(false);
    expect(shouldExtendSession(row({ campaign_id: 'c1' }), null, now)).toBe(false);
    expect(shouldExtendSession(row({ campaign_id: null }), 'c1', now)).toBe(false);
  });

  it('treats undefined and null campaign context as the same thing', () => {
    expect(shouldExtendSession(row({ campaign_id: null }), null, now)).toBe(true);
  });

  it('starts a new session when there is none, or the timestamp is unusable', () => {
    expect(shouldExtendSession(null, null, now)).toBe(false);
    expect(shouldExtendSession(row({ updated_at: 'not a date' }), null, now)).toBe(false);
  });
});

describe('nextMessageCount', () => {
  it('adds one exchange — a question and its answer', () => {
    expect(nextMessageCount(0)).toBe(MESSAGES_PER_EXCHANGE);
    expect(nextMessageCount(4)).toBe(6);
  });

  it('heals a nonsense stored count rather than counting on from it', () => {
    // The column is a plain integer with no CHECK.
    expect(nextMessageCount(-5)).toBe(MESSAGES_PER_EXCHANGE);
    expect(nextMessageCount(Number.NaN)).toBe(MESSAGES_PER_EXCHANGE);
  });
});

describe('summariseSessions', () => {
  it('counts conversations, messages and the most recent activity', () => {
    const summary = summariseSessions([
      row({ id: '1', message_count: 4, updated_at: '2026-08-01T09:00:00.000Z' }),
      row({ id: '2', message_count: 2, campaign_id: 'c1', updated_at: '2026-08-01T12:00:00.000Z' }),
      row({ id: '3', message_count: 6, campaign_id: 'c2', updated_at: '2026-07-30T12:00:00.000Z' }),
    ]);
    expect(summary.sessions).toBe(3);
    expect(summary.messages).toBe(12);
    expect(summary.campaignScoped).toBe(2);
    expect(summary.lastActiveAt).toBe('2026-08-01T12:00:00.000Z');
  });

  it('does not assume rows arrive sorted', () => {
    const summary = summariseSessions([
      row({ updated_at: '2026-08-01T12:00:00.000Z' }),
      row({ updated_at: '2026-08-01T09:00:00.000Z' }),
    ]);
    expect(summary.lastActiveAt).toBe('2026-08-01T12:00:00.000Z');
  });

  it('returns zeros and a null timestamp for no sessions', () => {
    // Meaningful, and different from a read failure — which is `null` at the
    // call site and never reaches this function.
    expect(summariseSessions([])).toEqual({
      sessions: 0, messages: 0, lastActiveAt: null, campaignScoped: 0,
    });
  });

  it('ignores a negative stored count instead of subtracting it', () => {
    expect(summariseSessions([row({ message_count: -3 }), row({ message_count: 2 })]).messages).toBe(2);
  });
});

describe('groupByCampaign', () => {
  it('keeps general coaching as its own group so the numbers add up', () => {
    const groups = groupByCampaign([
      row({ id: '1', campaign_id: null, message_count: 2, updated_at: '2026-08-01T08:00:00.000Z' }),
      row({ id: '2', campaign_id: 'c1', message_count: 4, updated_at: '2026-08-01T09:00:00.000Z' }),
      row({ id: '3', campaign_id: 'c1', message_count: 2, updated_at: '2026-08-01T11:00:00.000Z' }),
    ]);
    expect(groups.map((g) => g.campaignId)).toEqual(['c1', null]);
    const total = groups.reduce((sum, g) => sum + g.messages, 0);
    expect(total).toBe(summariseSessions([
      row({ message_count: 2 }), row({ message_count: 4 }), row({ message_count: 2 }),
    ]).messages);
  });

  it('orders groups by most recent activity', () => {
    const groups = groupByCampaign([
      row({ id: '1', campaign_id: 'old', updated_at: '2026-01-01T00:00:00.000Z' }),
      row({ id: '2', campaign_id: 'new', updated_at: '2026-08-01T00:00:00.000Z' }),
    ]);
    expect(groups[0]!.campaignId).toBe('new');
  });

  it('counts sessions per group, not rows collapsed', () => {
    const groups = groupByCampaign([row({ id: '1', campaign_id: 'c' }), row({ id: '2', campaign_id: 'c' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sessions).toBe(2);
  });

  it('returns an empty list for no rows', () => {
    expect(groupByCampaign([])).toEqual([]);
  });
});

describe('describeSummary', () => {
  it('says nothing at all when there has been no coaching', () => {
    // "0 coaching sessions" reads as a scold on a page whose job is to invite
    // the first question.
    expect(describeSummary(summariseSessions([]))).toBeNull();
  });

  it('is singular for one conversation and one question', () => {
    expect(describeSummary(summariseSessions([row({ message_count: 2 })]))).toBe('1 conversation · 1 question asked');
  });

  it('reports questions asked, not raw messages', () => {
    const text = describeSummary(summariseSessions([row({ message_count: 6 }), row({ id: '2', message_count: 2 })]));
    expect(text).toBe('2 conversations · 4 questions asked');
  });
});
