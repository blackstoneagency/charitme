import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSessionId,
  totalChargedCents,
  receiptReference,
  paymentMethodLabel,
  shareMessage,
  shareHref,
  SHARE_TARGETS,
} from '../lib/donation-outcome-core';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('parseSessionId', () => {
  it('accepts a real Stripe checkout session id', () => {
    expect(parseSessionId('cs_test_a1B2c3D4e5F6g7H8i9J0')).toBe('cs_test_a1B2c3D4e5F6g7H8i9J0');
    expect(parseSessionId('  cs_live_abcdefghij  ')).toBe('cs_live_abcdefghij');
  });

  it('rejects anything that is not one', () => {
    // This value is the authorization for four post-payment screens. Anything
    // that reaches a database filter without this shape is a lookup tool.
    for (const bad of [
      undefined, null, 42, '', '   ',
      'pi_1234567890',                       // a payment intent, not a session
      'cs_',                                 // prefix alone
      'cs_short',                            // below the length floor
      "cs_test_x'; drop table donations;--",  // punctuation is not in the charset
      'cs_test_' + 'x'.repeat(300),          // unbounded input into a query
      'CS_TEST_ABCDEFGHIJ',                  // Stripe ids are lowercase-prefixed
    ]) {
      expect(parseSessionId(bad as unknown), String(bad)).toBeNull();
    }
  });
});

describe('totalChargedCents', () => {
  it('adds the tip and processing fee back onto the gift', () => {
    // Three separate Stripe line items; the donor's statement shows the sum.
    expect(totalChargedCents({ amountCents: 5000, tipCents: 400, processingFeeCents: 175 })).toBe(5575);
  });

  it('equals the gift when there is no tip and no fee', () => {
    expect(totalChargedCents({ amountCents: 5000, tipCents: 0, processingFeeCents: 0 })).toBe(5000);
  });
});

describe('receiptReference', () => {
  it('is derived from the payment intent, so support can find it', () => {
    // Last twelve characters, upper-cased — the same value the emailed receipt
    // prints and the same one visible beside the charge in Stripe.
    expect(receiptReference('pi_abcdefghijkl')).toBe('ABCDEFGHIJKL');
  });

  it('is null rather than invented when there is no intent', () => {
    // A reference support would search for and never find is worse than none.
    expect(receiptReference(null)).toBeNull();
    expect(receiptReference('pi_short')).toBeNull();
  });
});

describe('paymentMethodLabel', () => {
  it('names the card the donor recognises', () => {
    expect(paymentMethodLabel({ type: 'card', brand: 'visa', last4: '4242' })).toBe('Visa •••• 4242');
    expect(paymentMethodLabel({ type: 'card', brand: 'amex', last4: '0005' })).toBe('American Express •••• 0005');
  });

  it('prefers the wallet over its funding card', () => {
    // The donor tapped Apple Pay. They have not seen the underlying card since
    // they set it up, and would not recognise its brand on a receipt.
    expect(paymentMethodLabel({ type: 'card', brand: 'visa', last4: '4242', wallet: 'apple_pay' }))
      .toBe('Apple Pay •••• 4242');
  });

  it('handles non-card methods', () => {
    expect(paymentMethodLabel({ type: 'cashapp' })).toBe('Cash App Pay');
    expect(paymentMethodLabel({ type: 'us_bank_account', last4: '6789' })).toBe('Bank transfer •••• 6789');
  });

  it('is null for anything it does not recognise', () => {
    // Omitting the row beats naming the wrong instrument on a receipt.
    expect(paymentMethodLabel(null)).toBeNull();
    expect(paymentMethodLabel({ type: 'some_new_method' })).toBeNull();
    expect(paymentMethodLabel({})).toBeNull();
  });
});

describe('shareMessage', () => {
  const url = 'https://www.charitme.com/campaigns/clean-water';

  it('names the cause and carries the link', () => {
    const msg = shareMessage('Clean Water for All', url);
    expect(msg).toContain('Clean Water for All');
    expect(msg).toContain(url);
  });

  it('never states the amount', () => {
    // This text goes onto a public timeline. A donor who gave anonymously, or
    // who simply does not publish what they give, must not be handed a post
    // that discloses it.
    const msg = shareMessage('Clean Water for All', url);
    expect(msg).not.toMatch(/\$|\d+\.\d{2}|\bUSD\b/);
  });

  it('still reads as a sentence with no title', () => {
    const msg = shareMessage('   ', url);
    expect(msg).not.toContain('""');
    expect(msg).toContain('a cause I believe in');
  });
});

describe('shareHref', () => {
  const url = 'https://www.charitme.com/campaigns/clean-water?a=1&b=2';
  const message = shareMessage('Clean Water', url);

  it('encodes the url in every target', () => {
    for (const target of SHARE_TARGETS) {
      const href = shareHref(target, url, message);
      if (href === null) continue;
      // A raw `&` in the campaign URL would truncate the share intent.
      expect(href, target).not.toContain('?a=1&b=2');
      expect(href, target).toContain(encodeURIComponent(url));
    }
  });

  it('gives the copy tile no href, because it copies rather than navigates', () => {
    expect(shareHref('link', url, message)).toBeNull();
  });

  it('does not repeat the url inside the X post text', () => {
    // X renders the `url` parameter itself; leaving it in `text` too posts it twice.
    const href = shareHref('twitter', url, message)!;
    const text = new URL(href).searchParams.get('text') ?? '';
    expect(text).not.toContain(url);
    expect(text).toContain('Clean Water');
  });
});

describe('the flow is wired end to end', () => {
  const read = (p: string) => readFileSync(join(WEB_ROOT, p), 'utf8');

  it('every post-payment page resolves the donation server-side, never from the URL', () => {
    // The old success URL carried `?amount=`, which is visitor-editable, and the
    // page rendered an official-looking confirmation from it.
    for (const page of [
      'app/thank-you/page.tsx',
      'app/thank-you/receipt/page.tsx',
      'app/thank-you/share/page.tsx',
      'app/thank-you/done/page.tsx',
    ]) {
      const src = read(page);
      expect(src, page).toContain('getDonationOutcome');
      expect(src, page).not.toMatch(/searchParams[^\n]*\bamount\b/);
    }
  });

  it('every post-payment page is noindex — the URL is a bearer credential', () => {
    for (const page of [
      'app/thank-you/page.tsx',
      'app/thank-you/receipt/page.tsx',
      'app/thank-you/share/page.tsx',
      'app/thank-you/done/page.tsx',
    ]) {
      expect(read(page), page).toContain('robots: { index: false, follow: false }');
    }
  });

  it('the share step attributes to the campaign it resolved, not one from the URL', () => {
    // A caller-supplied campaign id would let anyone inflate another campaign's
    // share counters, which feed its analytics and referral attribution.
    const page = read('app/thank-you/share/page.tsx');
    expect(page).toContain('campaignId={outcome.campaignId}');
  });

  it('the download route refuses a session that has no donation row yet', () => {
    const route = read('app/api/donations/receipt/session/route.ts');
    expect(route).toContain('RECEIPT_PENDING');
    expect(route).toContain('parseSessionId');
    expect(route).toContain('checkRateLimitDurable');
  });

  it('still collects no raw card fields anywhere in the flow', () => {
    // Steps 4 and 5 of the artwork are a card form. Building it would put this
    // site in PCI-DSS scope; Stripe Checkout renders them instead.
    for (const page of [
      'app/thank-you/page.tsx',
      'app/thank-you/receipt/page.tsx',
      'app/thank-you/share/ShareSupport.tsx',
      'app/thank-you/CopyField.tsx',
      'app/donate/[slug]/GuidedDonation.tsx',
    ]) {
      const src = read(page);
      for (const field of ['cc-number', 'cc-csc', 'cc-exp']) {
        expect(src, `${page} must not collect ${field}`).not.toContain(field);
      }
    }
  });
});
