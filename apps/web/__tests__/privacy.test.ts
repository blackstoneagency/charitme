import { describe, expect, it } from 'vitest';
import {
  isActive,
  isTerminal,
  canTransitionRequest,
  anonymizedProfilePatch,
  RequestCreateSchema,
  RequestUpdateSchema,
} from '../lib/privacy-core';

describe('status predicates', () => {
  it('isActive covers pending + in_progress only', () => {
    expect(isActive('pending')).toBe(true);
    expect(isActive('in_progress')).toBe(true);
    expect(isActive('completed')).toBe(false);
    expect(isActive('cancelled')).toBe(false);
  });
  it('isTerminal covers completed/rejected/cancelled', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('in_progress')).toBe(false);
  });
});

describe('privacy request state machine', () => {
  it('lets a user cancel an open request', () => {
    expect(canTransitionRequest('user', 'pending', 'cancelled')).toBe(true);
    expect(canTransitionRequest('user', 'in_progress', 'cancelled')).toBe(true);
  });
  it('forbids a user completing or rejecting their own request', () => {
    expect(canTransitionRequest('user', 'pending', 'completed')).toBe(false);
    expect(canTransitionRequest('user', 'pending', 'rejected')).toBe(false);
  });
  it('lets an admin progress and resolve a request', () => {
    expect(canTransitionRequest('admin', 'pending', 'in_progress')).toBe(true);
    expect(canTransitionRequest('admin', 'in_progress', 'completed')).toBe(true);
    expect(canTransitionRequest('admin', 'pending', 'rejected')).toBe(true);
  });
  it('forbids reviving a terminal request', () => {
    expect(canTransitionRequest('admin', 'completed', 'in_progress')).toBe(false);
    expect(canTransitionRequest('admin', 'cancelled', 'in_progress')).toBe(false);
  });
});

describe('anonymizedProfilePatch', () => {
  it('scrubs PII fields and derives a stable placeholder email', () => {
    const patch = anonymizedProfilePatch('abcdef12-0000-0000-0000-000000000000');
    expect(patch.full_name).toBe('Deleted User');
    expect(patch.email).toBe('deleted+abcdef12@charitme.invalid');
    expect(patch.avatar_url).toBeNull();
    expect(patch.bio).toBeNull();
  });
});

describe('validation schemas', () => {
  it('accepts export and deletion request types', () => {
    expect(RequestCreateSchema.safeParse({ type: 'export' }).success).toBe(true);
    expect(RequestCreateSchema.safeParse({ type: 'deletion', note: 'leaving' }).success).toBe(true);
  });
  it('rejects an unknown request type', () => {
    expect(RequestCreateSchema.safeParse({ type: 'sell-my-data' }).success).toBe(false);
  });
  it('rejects an update to a non-permitted status', () => {
    expect(RequestUpdateSchema.safeParse({ status: 'pending' }).success).toBe(false);
    expect(RequestUpdateSchema.safeParse({ status: 'completed' }).success).toBe(true);
  });
});

// ── RLS policy logic simulation ───────────────────────────────────────────────
describe('privacy_requests RLS: read scope', () => {
  function canRead(row: { user_id: string }, uid: string | null, isAdmin: boolean): boolean {
    return row.user_id === uid || isAdmin;
  }
  it('the owner can read their own request', () => {
    expect(canRead({ user_id: 'u1' }, 'u1', false)).toBe(true);
  });
  it('an admin can read any request', () => {
    expect(canRead({ user_id: 'u1' }, 'admin', true)).toBe(true);
  });
  it('an unrelated user cannot read the request', () => {
    expect(canRead({ user_id: 'u1' }, 'u2', false)).toBe(false);
  });
});
