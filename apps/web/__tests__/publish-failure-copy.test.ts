import { describe, it, expect } from 'vitest';
import { describePublishFailure } from '../lib/campaign-draft';

describe('describePublishFailure', () => {
  it('never leaks a raw database string to the organizer', () => {
    const raw = 'duplicate key value violates unique constraint "campaigns_slug_key"';
    const out = describePublishFailure(raw, 409);
    expect(out.message).not.toContain('constraint');
    expect(out.message).not.toContain('duplicate key');
    expect(out.message).toMatch(/title/i);
  });

  it('maps auth failures to a re-sign-in prompt that reassures about saved work', () => {
    const out = describePublishFailure('Unauthorized', 401);
    expect(out.message).toMatch(/sign in/i);
    expect(out.retryable).toBe(false);
  });

  it('marks transient failures retryable and terminal ones not', () => {
    expect(describePublishFailure('', 500).retryable).toBe(true);
    expect(describePublishFailure('rate limit exceeded', 429).retryable).toBe(true);
    expect(describePublishFailure('duplicate', 409).retryable).toBe(false);
  });

  it('points at the specific step when the API blames a field', () => {
    expect(describePublishFailure('goal amount too low', 400).message).toMatch(/goal step/i);
    expect(describePublishFailure('image upload failed', 400).message).toMatch(/media step/i);
  });

  it('always returns a non-empty, actionable message for unknown input', () => {
    for (const input of [undefined, null, 42, {}, '', 'something bizarre']) {
      const out = describePublishFailure(input as unknown);
      expect(out.message.length).toBeGreaterThan(10);
      expect(out.message).toMatch(/try again|sign in|check/i);
    }
  });

  it('reassures that work is saved on a network failure', () => {
    expect(describePublishFailure('network request failed').message).toMatch(/saved/i);
  });
});
