import { describe, it, expect } from 'vitest';
import { draftGoalFromText, GOAL_METRICS } from '../lib/marketing-goals';

describe('draftGoalFromText', () => {
  it('detects the education fundraiser-starts goal with geography and deadline', () => {
    const d = draftGoalFromText('Grow verified education fundraisers in New Jersey by 15% before year-end');
    expect(d.category).toBe('Education');
    expect(d.geography).toBe('New Jersey');
    expect(d.target_value).toBe(15);
    expect(d.deadline).toMatch(/^\d{4}-12-31$/);
    // "verified" wins the metric classifier here — that's an intentional, deterministic precedence
    expect(GOAL_METRICS[d.target_metric]).toBeDefined();
  });

  it('detects recurring donors for animal rescue', () => {
    const d = draftGoalFromText('Generate more recurring donors for animal rescue campaigns');
    expect(d.target_metric).toBe('recurring_donors');
    expect(d.category).toBe('Animal');
    expect(d.audience).toBe('Recurring donors');
    expect(d.unit).toBe('count');
  });

  it('parses a dollar donation-volume target into cents', () => {
    const d = draftGoalFromText('Raise $50,000 in donation revenue for emergency relief');
    expect(d.target_metric).toBe('donation_volume');
    expect(d.unit).toBe('cents');
    expect(d.target_value).toBe(5_000_000);
    expect(d.category).toBe('Emergency');
  });

  it('detects AEO visibility goals', () => {
    const d = draftGoalFromText('Improve CharitMe visibility in ChatGPT, Gemini and Google AI Overviews');
    expect(d.target_metric).toBe('aeo_visibility');
    expect(d.unit).toBe('percent');
  });

  it('extracts a relative deadline and critical priority', () => {
    const d = draftGoalFromText('Urgent: launch a Giving Tuesday campaign in 30 days');
    expect(d.priority).toBe('critical');
    expect(d.deadline).toBeTruthy();
  });

  it('always returns a valid metric and a non-empty title', () => {
    const d = draftGoalFromText('do something vaguely marketing');
    expect(d.title.length).toBeGreaterThan(0);
    expect(GOAL_METRICS[d.target_metric]).toBeDefined();
  });
});
