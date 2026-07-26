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
  it.each([ADMIN_ROUTE, DONOR_ROUTE])('%s branches on the send result', (path) => {
    const src = read(path);
    expect(src, `${path} ignores whether the email sent`).toMatch(/\{\s*sent\s*\}\s*=\s*await sendReceiptEmail/);
    expect(src, `${path} does not bail out when the send failed`).toMatch(/if\s*\(!sent\)/);
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
    // The donor route's bug was `.eq('id', user.id)` when loading the profile.
    const donor = read(DONOR_ROUTE);
    expect(donor).toContain("don.donor_id ?? user.id");
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
