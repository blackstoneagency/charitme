import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sendReceiptEmail,
  sendTaxReceiptEmail,
  sendBeneficiaryInviteEmail,
  resend,
} from '../lib/email';

const WEB_ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

const ADMIN_ROUTE = 'app/api/admin/donations/[id]/receipt/route.ts';
const DONOR_ROUTE = 'app/api/donations/receipt/route.ts';
const STRIPE_WEBHOOK = 'app/api/stripe/webhook/route.ts';

// ─────────────────────────────────────────────────────────────────────────────
// A donation receipt is a tax document. The two defects this pins:
//
// 1. The admin "Send receipt" endpoint stamped `receipt_sent_at`, wrote an
//    audit-log entry `donation.receipt_sent`, and returned ok — while sending NO
//    email. The console then said "A donation receipt has been sent to <donor>".
//    A document the donor never got was recorded as delivered, in the very log
//    kept to evidence delivery.
// 2. The donor-facing endpoint loaded the profile of the *requesting* user, so an
//    admin issuing a receipt sent it to themselves, under their own name.
// ─────────────────────────────────────────────────────────────────────────────

describe('sendReceiptEmail reports whether it actually sent', () => {
  it('has no transport configured in this environment', () => {
    // Guards the assertion below from silently becoming vacuous if a key appears.
    expect(resend).toBeNull();
  });

  it('returns sent:false instead of resolving silently', async () => {
    const result = await sendReceiptEmail({
      to: 'donor@example.com',
      donorName: 'Donor',
      campaignTitle: 'Test campaign',
      campaignSlug: 'test-campaign',
      amountFormatted: '$25.00',
      donationId: '00000000-0000-0000-0000-000000000000',
    });
    // It used to return `void`, so `!sent` was always true and no caller could
    // distinguish "delivered" from "dropped on the floor".
    expect(result).toEqual({ sent: false });
  });
});

describe('receipt endpoints record only what actually happened', () => {
  it('both routes branch on the send result', () => {
    const admin = read(ADMIN_ROUTE);
    expect(admin).toMatch(/\{\s*sent\s*\}\s*=\s*await sendReceiptEmail/);
    expect(admin).toMatch(/if\s*\(!sent\)/);

    const donor = read(DONOR_ROUTE);
    expect(donor).toContain('if (!delivery.sent)');
  });

  it('the admin route sends BEFORE it stamps receipt_sent_at', () => {
    const src = read(ADMIN_ROUTE);
    const sendAt = src.indexOf('await sendReceiptEmail');
    const stampAt = src.indexOf('receipt_sent_at: now');
    expect(sendAt).toBeGreaterThan(-1);
    expect(stampAt).toBeGreaterThan(-1);
    expect(sendAt, 'receipt_sent_at is stamped before the email is sent').toBeLessThan(stampAt);
  });

  it('the admin route writes the audit log only after a successful send', () => {
    const src = read(ADMIN_ROUTE);
    const bail = src.indexOf('EMAIL_UNAVAILABLE');
    const audit = src.indexOf("action: 'donation.receipt_sent'");
    expect(bail).toBeGreaterThan(-1);
    expect(audit).toBeGreaterThan(bail);
  });

  it('both routes address the donor, never the requesting user', () => {
    const donor = read(DONOR_ROUTE);
    expect(donor).toContain("canAccessDonationReceipt({");
    expect(donor).toContain(".eq('id', don.donor_id)");
    expect(donor).not.toMatch(/select\('full_name, email'\)\s*\n?\s*\.eq\('id', user\.id\)/);

    const admin = read(ADMIN_ROUTE);
    expect(admin).toContain('don.donor_id');
    expect(admin).toContain('offline_donor_email');
  });

  it('the admin route records the receipt in the donation_receipts ledger', () => {
    // The table shipped with receipt_number / email_sent_at / resent_at columns
    // and had never been written to — 0 rows in production.
    const src = read(ADMIN_ROUTE);
    expect(src).toContain("from('donation_receipts')");
    expect(src).toContain('email_sent_at');
    expect(src).toContain('resent_at');
  });

  it('deductibility comes from campaign verification, not the donor role', () => {
    const src = read(ADMIN_ROUTE);
    expect(src).toMatch(/is_tax_deductible:\s*campaign\.nonprofit_verified/);
  });

  it('authorises with isAdmin(), not a raw roles array check', () => {
    const src = read(DONOR_ROUTE);
    expect(src).toContain('await isAdmin(');
    // The raw check missed hardcoded owner emails, ADMIN_EMAILS, and super admins
    // who do not also hold `admin`.
    expect(src).not.toMatch(/roles\.includes\('admin'\)/);
  });

  it('lets an authenticated former guest re-send only an unclaimed email-owned receipt', () => {
    const src = read(DONOR_ROUTE);
    expect(src).toContain('canAccessDonationReceipt({');
    expect(src).toContain('receiptEmail: receipt?.donor_email ?? null');
    expect(src).toContain('if (!ownsReceipt && !(await isAdmin(');
  });

  it('preserves official tax receipt details on re-send', () => {
    const src = read(DONOR_ROUTE);
    expect(src).toContain("from('tax_receipts')");
    expect(src).toContain('await sendTaxReceiptEmail({');
    expect(src).toContain('receiptNumber: taxReceipt.receipt_number');
  });

  it('durably rate limits donor and admin receipt sends', () => {
    const donor = read(DONOR_ROUTE);
    const admin = read('app/api/admin/donations/tax-receipt/route.ts');
    expect(donor).toContain('await checkRateLimitDurable(`donation-receipt:${user.id}`');
    expect(admin).toContain('await checkRateLimitDurable(`admin-tax-receipt:${user.id}`');
    expect(donor).toContain("code: 'RATE_LIMITED'");
    expect(admin).toContain("code: 'RATE_LIMITED'");
  });
});

describe('checkout receipts include guest donors', () => {
  it('does not gate one-time receipts on a signed-in donor id', () => {
    const src = read(STRIPE_WEBHOOK);
    expect(src).toContain('if (!alreadyDone && amountCents > 0)');
    expect(src).not.toContain('if (!alreadyDone && meta.donorId && amountCents > 0)');
  });

  it('uses the Stripe checkout email when no account is attached', () => {
    const src = read(STRIPE_WEBHOOK);
    expect(src).toContain('session.customer_details?.email ?? session.customer_email');
    expect(src).toContain('if (!recipient.donorId && !recipient.email) return');
    expect(src).toContain('donor_id: donationRow.donor_id ?? recipient.donorId ?? null');
  });

  it('persists official tax-receipt delivery only after the email sends', () => {
    const src = read(STRIPE_WEBHOOK);
    const sendAt = src.indexOf('const taxDelivery = await sendTaxReceiptEmail');
    const bailAt = src.indexOf('if (!taxDelivery.sent) return', sendAt);
    const persistAt = src.indexOf("from('tax_receipts').upsert", sendAt);
    expect(sendAt).toBeGreaterThan(-1);
    expect(bailAt).toBeGreaterThan(sendAt);
    expect(persistAt).toBeGreaterThan(bailAt);
  });

  it('records every automatic receipt in the receipt ledger', () => {
    const src = read(STRIPE_WEBHOOK);
    expect(src).toContain("from('donation_receipts')");
    expect(src).toContain('donor_email: normalizeReceiptEmail(donorEmail)');
    expect(src).toContain('receipt_type: receiptType');
  });

  it('does not treat notification preferences as a transactional receipt opt-out', () => {
    const src = read(STRIPE_WEBHOOK);
    const receiptSender = src.slice(
      src.indexOf('async function sendDonorReceipt'),
      src.indexOf('async function sendOrganizerDonationNotification'),
    );
    expect(receiptSender).not.toContain('notification_email');
  });

  it('issues a discrete receipt for every recurring renewal', () => {
    const src = read(STRIPE_WEBHOOK);
    const renewal = src.slice(src.indexOf('async function handleInvoiceSucceeded'));
    expect(renewal).toContain('const renewalDonationId = await findDonationId');
    expect(renewal).toContain('await sendDonorReceipt(');
    expect(renewal).toContain("renewalDonationId ?? undefined,\n    'recurring'");
  });
});

// The IRS-facing tax receipt had the identical defect: it upserted `tax_receipts`
// with `emailed_at` and wrote a `donation.tax_receipt_sent` audit entry regardless
// of whether the email left the building.
describe('tax receipts record only real sends', () => {
  it('sendTaxReceiptEmail reports sent:false with no transport', async () => {
    await expect(
      sendTaxReceiptEmail({
        to: 'donor@example.com',
        donorName: 'Donor',
        nonprofitName: 'Test Org',
        nonprofitEin: '12-3456789',
        campaignTitle: 'Test campaign',
        amountFormatted: '$25.00',
        receiptNumber: 'RCP-2026-ABCDEF12',
        donationDate: 'January 1, 2026',
      }),
    ).resolves.toEqual({ sent: false });
  });

  it('the route bails before stamping emailed_at', () => {
    const src = read('app/api/admin/donations/tax-receipt/route.ts');
    const bail = src.indexOf('EMAIL_UNAVAILABLE');
    expect(bail).toBeGreaterThan(-1);
    // The property write, not the comment above it that mentions the column.
    expect(src.indexOf('emailed_at:')).toBeGreaterThan(bail);
    expect(src.indexOf("action: 'donation.tax_receipt_sent'")).toBeGreaterThan(bail);
  });

  it('the admin route can use the persisted guest receipt recipient', () => {
    const src = read('app/api/admin/donations/tax-receipt/route.ts');
    expect(src).toContain("from('donation_receipts')");
    expect(src).toContain('receiptRecipient?.donor_email');
    expect(src).not.toContain('Cannot send tax receipt for anonymous donation');
  });
});

// Every sender must be able to say whether it delivered. Returning void is what
// let three separate routes record deliveries that never happened.
describe('no email helper resolves silently', () => {
  it('sendBeneficiaryInviteEmail reports its result too', async () => {
    await expect(
      sendBeneficiaryInviteEmail({
        to: 'b@example.com',
        organizerName: 'Organizer',
        campaignTitle: 'Test campaign',
        campaignSlug: 'test-campaign',
        inviteToken: 'tok',
      }),
    ).resolves.toEqual({ sent: false });
  });

  it('lib/email declares no sender returning Promise<void>', () => {
    const src = read('lib/email.ts');
    const senders = [...src.matchAll(/export async function (send\w+)\(/g)].map((m) => m[1]);
    expect(senders.length).toBeGreaterThanOrEqual(9);
    // Not one of them may declare Promise<void> — that is the shape that made a
    // dropped email indistinguishable from a delivered one.
    expect(src, `a sender still returns Promise<void>: ${senders.join(', ')}`)
      .not.toContain('): Promise<void> {');
    // …and each must be able to report the no-transport case.
    expect(src.match(/return \{ sent: false \};/g)?.length ?? 0).toBeGreaterThanOrEqual(senders.length);
  });
});
