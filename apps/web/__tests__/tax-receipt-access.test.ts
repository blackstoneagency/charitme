import { describe, expect, it } from 'vitest';
import {
  canAccessDonationReceipt,
  normalizeReceiptEmail,
} from '../lib/tax-receipt-access';

describe('tax receipt access', () => {
  it('normalizes receipt emails for verified-account matching', () => {
    expect(normalizeReceiptEmail(' Donor@Example.COM ')).toBe('donor@example.com');
  });

  it('allows the authenticated donor id', () => {
    expect(canAccessDonationReceipt({
      userId: 'user-1',
      userEmail: 'donor@example.com',
      donationDonorId: 'user-1',
      receiptDonorId: null,
      receiptEmail: null,
    })).toBe(true);
  });

  it('allows an unclaimed guest receipt with the signed-in email', () => {
    expect(canAccessDonationReceipt({
      userId: 'user-1',
      userEmail: 'Donor@Example.com',
      donationDonorId: null,
      receiptDonorId: null,
      receiptEmail: 'donor@example.com',
    })).toBe(true);
  });

  it('does not use email to override a different donor owner', () => {
    expect(canAccessDonationReceipt({
      userId: 'user-1',
      userEmail: 'donor@example.com',
      donationDonorId: 'user-2',
      receiptDonorId: 'user-2',
      receiptEmail: 'donor@example.com',
    })).toBe(false);
  });

  it('rejects conflicting donation and receipt owners', () => {
    expect(canAccessDonationReceipt({
      userId: 'user-1',
      userEmail: 'donor@example.com',
      donationDonorId: 'user-2',
      receiptDonorId: 'user-1',
      receiptEmail: 'donor@example.com',
    })).toBe(false);
  });

  it('rejects an unclaimed receipt with another email', () => {
    expect(canAccessDonationReceipt({
      userId: 'user-1',
      userEmail: 'donor@example.com',
      donationDonorId: null,
      receiptDonorId: null,
      receiptEmail: 'other@example.com',
    })).toBe(false);
  });
});
