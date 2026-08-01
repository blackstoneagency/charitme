import { describe, it, expect } from 'vitest';
import {
  donationReceiptEmail,
  taxReceiptEmail,
  escapeHtml,
  emailWrapper,
  btn,
} from '../lib/receipt-template';

const ORIGIN = 'https://www.charitme.com';

const donation = {
  donorName: 'Ada Lovelace',
  campaignTitle: 'Wheelchair van for the Okonkwo family',
  campaignSlug: 'wheelchair-van',
  amountFormatted: '$250.00',
  donationId: 'dona0000-0000-4000-8000-000000000001',
};

const tax = {
  donorName: 'Ada Lovelace',
  nonprofitName: 'Rivers Trust',
  nonprofitEin: '12-3456789',
  campaignTitle: 'Clean water for Ikot Ekpene',
  amountFormatted: '$1,000.00',
  receiptNumber: 'RCP-2026-ABCD1234',
  donationDate: 'August 1, 2026',
};

describe('donationReceiptEmail', () => {
  it('carries the amount, the campaign and the reference', () => {
    const m = donationReceiptEmail(donation, ORIGIN, 2026);
    expect(m.html).toContain('$250.00');
    expect(m.html).toContain('Wheelchair van for the Okonkwo family');
    expect(m.html).toContain('Ref: dona0000-0000-4000-8000-000000000001');
    expect(m.subject).toBe('Your CharitMe receipt — Wheelchair van for the Okonkwo family');
  });

  it('greets by first name only, and greets nobody when there is no name', () => {
    expect(donationReceiptEmail(donation, ORIGIN, 2026).html).toContain('Thank you, Ada!');
    const anon = donationReceiptEmail({ ...donation, donorName: null }, ORIGIN, 2026);
    expect(anon.html).toContain('Thank you!');
    expect(anon.html).not.toContain('undefined');
    expect(anon.html).not.toContain('null');
  });

  it('emits absolute links — an email cannot resolve a relative path', () => {
    const m = donationReceiptEmail(donation, ORIGIN, 2026);
    expect(m.html).toContain('https://www.charitme.com/campaigns/wheelchair-van');
    expect(m.html).toContain('https://www.charitme.com/donor');
    expect(m.html).not.toContain('href="/');
  });

  it('does not double the slash when the origin has a trailing one', () => {
    const m = donationReceiptEmail(donation, 'https://www.charitme.com/', 2026);
    expect(m.html).not.toContain('com//');
  });
});

describe('taxReceiptEmail', () => {
  it('carries every field a tax document needs', () => {
    const m = taxReceiptEmail(tax, ORIGIN, 2026);
    for (const value of ['Rivers Trust', '12-3456789', 'Clean water for Ikot Ekpene', 'August 1, 2026', 'RCP-2026-ABCD1234', '$1,000.00']) {
      expect(m.html, value).toContain(value);
      expect(m.text, value).toContain(value);
    }
    expect(m.subject).toBe('Tax Receipt #RCP-2026-ABCD1234 — Rivers Trust');
  });

  it('states that no goods or services were provided — the IRS wording', () => {
    expect(taxReceiptEmail(tax, ORIGIN, 2026).html).toMatch(/no goods or services/i);
  });
});

describe('HTML escaping', () => {
  // These templates concatenated campaign titles, donor names and nonprofit
  // names straight into HTML. All three are user-controlled, and the output is
  // an email delivered to a donor — an injection with a recipient list attached.
  const nasty = '</td></table><script>alert(1)</script><a href="https://evil.test">Click';

  it('escapes a campaign title, so markup in it cannot reach the donor', () => {
    const m = donationReceiptEmail({ ...donation, campaignTitle: nasty }, ORIGIN, 2026);
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('href="https://evil.test"');
    expect(m.html).toContain('&lt;script&gt;');
  });

  it('escapes the donor name', () => {
    const m = donationReceiptEmail({ ...donation, donorName: '<img src=x onerror=alert(1)>' }, ORIGIN, 2026);
    expect(m.html).not.toContain('<img src=x');
  });

  it('escapes every field of a tax receipt', () => {
    const m = taxReceiptEmail(
      { ...tax, nonprofitName: nasty, nonprofitEin: nasty, campaignTitle: nasty, receiptNumber: nasty, donationDate: nasty },
      ORIGIN,
      2026,
    );
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('</td></table><');
  });

  it('escapeHtml covers the five characters that matter', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes ampersands FIRST, so entities are not double-broken', () => {
    // Escaping < before & would turn "a & b" into "a &amp; b" correctly but
    // "a &lt; b" (already escaped) into "a &amp;lt; b". Order is what makes the
    // single-pass version correct.
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c');
  });

  it('escapes the wrapper title and the button label', () => {
    expect(emailWrapper('<b>x</b>', 'body', 2026, ORIGIN)).not.toContain('<b>x</b>');
    expect(btn('https://x.test', '<b>Go</b>')).not.toContain('<b>Go</b>');
  });
});

describe('the wrapper', () => {
  it('is a complete document — email clients do not repair fragments', () => {
    const html = donationReceiptEmail(donation, ORIGIN, 2026).html;
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('carries the year it was given, not today', () => {
    expect(donationReceiptEmail(donation, ORIGIN, 1999).html).toContain('© 1999 CharitMe');
  });
});
