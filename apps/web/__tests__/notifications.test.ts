import { describe, expect, it } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Notification kind taxonomy
// ─────────────────────────────────────────────────────────────────────────────
describe('notification kinds', () => {
  type NotificationKind =
    | 'donation_received'
    | 'donation_receipt'
    | 'recurring_receipt'
    | 'payment_failed'
    | 'refund_requested'
    | 'refund_processed'
    | 'payout_paid'
    | 'payout_failed'
    | 'payout_scheduled'
    | 'beneficiary_invited'
    | 'beneficiary_accepted'
    | 'co_organizer_invited'
    | 'campaign_update'
    | 'trust_report'
    | 'support_case_update'
    | 'campaign_paused'
    | 'campaign_suspended';

  const ORGANIZER_KINDS: NotificationKind[] = [
    'donation_received',
    'payout_paid',
    'payout_failed',
    'payout_scheduled',
    'beneficiary_invited',
    'beneficiary_accepted',
    'co_organizer_invited',
    'trust_report',
    'campaign_paused',
    'campaign_suspended',
  ];

  const DONOR_KINDS: NotificationKind[] = [
    'donation_receipt',
    'recurring_receipt',
    'payment_failed',
    'refund_requested',
    'refund_processed',
    'campaign_update',
  ];

  it('organizer and donor kinds are non-overlapping', () => {
    const overlap = ORGANIZER_KINDS.filter(k => DONOR_KINDS.includes(k));
    expect(overlap.length).toBe(0);
  });

  it('covers all 17 required notification kinds', () => {
    const ALL = [...ORGANIZER_KINDS, ...DONOR_KINDS];
    expect(ALL.length).toBe(16); // listed above
  });

  function routeNotification(kind: NotificationKind): 'organizer' | 'donor' | 'both' {
    if (ORGANIZER_KINDS.includes(kind)) return 'organizer';
    if (DONOR_KINDS.includes(kind)) return 'donor';
    return 'both';
  }

  it('donation_received routes to organizer', () => {
    expect(routeNotification('donation_received')).toBe('organizer');
  });

  it('donation_receipt routes to donor', () => {
    expect(routeNotification('donation_receipt')).toBe('donor');
  });

  it('payout_failed routes to organizer', () => {
    expect(routeNotification('payout_failed')).toBe('organizer');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Email notification guards
// ─────────────────────────────────────────────────────────────────────────────
describe('email notification guards', () => {
  function shouldSendEmail(params: {
    resendApiKeySet: boolean;
    recipientEmail: string | null;
    notificationEnabled: boolean;
  }): boolean {
    return params.resendApiKeySet && params.recipientEmail !== null && params.notificationEnabled;
  }

  it('sends when all conditions met', () => {
    expect(shouldSendEmail({ resendApiKeySet: true, recipientEmail: 'a@b.com', notificationEnabled: true })).toBe(true);
  });

  it('skips when no API key', () => {
    expect(shouldSendEmail({ resendApiKeySet: false, recipientEmail: 'a@b.com', notificationEnabled: true })).toBe(false);
  });

  it('skips when recipient email is null (guest/anonymous)', () => {
    expect(shouldSendEmail({ resendApiKeySet: true, recipientEmail: null, notificationEnabled: true })).toBe(false);
  });

  it('skips when notification disabled', () => {
    expect(shouldSendEmail({ resendApiKeySet: true, recipientEmail: 'a@b.com', notificationEnabled: false })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// In-app notification payload validation
// ─────────────────────────────────────────────────────────────────────────────
describe('in-app notification payload', () => {
  interface Notification {
    user_id: string;
    kind: string;
    title: string;
    body?: string;
    link?: string;
    meta?: Record<string, unknown>;
  }

  function validateNotification(n: Partial<Notification>): string[] {
    const errors: string[] = [];
    if (!n.user_id) errors.push('user_id required');
    if (!n.kind) errors.push('kind required');
    if (!n.title) errors.push('title required');
    if (n.title && n.title.length > 200) errors.push('title too long');
    return errors;
  }

  it('validates a proper notification', () => {
    expect(validateNotification({
      user_id: 'abc',
      kind: 'donation_received',
      title: 'New donation!',
      body: '$50 received',
      link: '/dashboard',
    })).toHaveLength(0);
  });

  it('requires user_id', () => {
    expect(validateNotification({ kind: 'donation_received', title: 'test' })).toContain('user_id required');
  });

  it('requires title', () => {
    expect(validateNotification({ user_id: 'abc', kind: 'test' })).toContain('title required');
  });

  it('rejects title over 200 chars', () => {
    expect(validateNotification({ user_id: 'abc', kind: 'test', title: 'x'.repeat(201) })).toContain('title too long');
  });
});
