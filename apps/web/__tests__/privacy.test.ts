import { describe, expect, it } from 'vitest';
import {
  allowedPrivacyTransition,
  canTransitionPrivacyRequest,
  isPrivacyRequestStatus,
  isPrivacyRequestType,
  isTerminalPrivacyStatus,
  privacyRequestStatusLabel,
  privacyRequestTypeLabel,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../lib/privacy';

describe('privacy request state machine', () => {
  it('allows documented transitions', () => {
    expect(canTransitionPrivacyRequest('pending', 'processing')).toBe(true);
    expect(canTransitionPrivacyRequest('pending', 'cancelled')).toBe(true);
    expect(canTransitionPrivacyRequest('processing', 'completed')).toBe(true);
  });
  it('blocks terminal and illegal transitions', () => {
    expect(canTransitionPrivacyRequest('completed', 'pending')).toBe(false);
    expect(canTransitionPrivacyRequest('rejected', 'processing')).toBe(false);
    expect(canTransitionPrivacyRequest('cancelled', 'pending')).toBe(false);
  });
  it('flags terminal statuses', () => {
    expect(isTerminalPrivacyStatus('completed')).toBe(true);
    expect(isTerminalPrivacyStatus('pending')).toBe(false);
  });
});

describe('actor-scoped privacy transitions', () => {
  it('user may only cancel', () => {
    expect(allowedPrivacyTransition('user', 'pending', 'cancelled')).toBe(true);
    expect(allowedPrivacyTransition('user', 'pending', 'completed')).toBe(false);
    expect(allowedPrivacyTransition('user', 'processing', 'completed')).toBe(false);
  });
  it('admin may fulfill', () => {
    expect(allowedPrivacyTransition('admin', 'pending', 'processing')).toBe(true);
    expect(allowedPrivacyTransition('admin', 'processing', 'completed')).toBe(true);
    expect(allowedPrivacyTransition('admin', 'processing', 'rejected')).toBe(true);
    // still bounded by the machine
    expect(allowedPrivacyTransition('admin', 'completed', 'pending')).toBe(false);
  });
});

describe('type + status helpers', () => {
  it('validates types and statuses', () => {
    expect(isPrivacyRequestType('export')).toBe(true);
    expect(isPrivacyRequestType('deletion')).toBe(true);
    expect(isPrivacyRequestType('nope')).toBe(false);
    expect(isPrivacyRequestStatus('completed')).toBe(true);
    expect(isPrivacyRequestStatus('weird')).toBe(false);
  });
  it('labels every type and status', () => {
    for (const t of PRIVACY_REQUEST_TYPES) expect(privacyRequestTypeLabel(t)).toBeTruthy();
    for (const s of PRIVACY_REQUEST_STATUSES) expect(privacyRequestStatusLabel(s)).toBeTruthy();
  });
});
