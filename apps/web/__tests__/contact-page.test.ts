import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { usableContactValue, formatContactCount } from '../lib/contact-page';
import { DEFAULTS } from '../lib/settings-defaults';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/contact/page.tsx');
const form = read('app/contact/ContactForm.tsx');
const faqUi = read('app/contact/ContactFaq.tsx');
const loader = read('lib/contact-page.ts');
const icons = read('components/PublicIcon.tsx');

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('the invented contact details are gone', () => {
  it('hard-codes no phone number and no postal address', () => {
    // The previous page printed "+1 (888) 123-4567" and "123 Impact Way, Suite
    // 400, San Francisco, CA 94107" as literal JSX. Neither existed anywhere in
    // the schema or the settings store — they were invented. A fabricated
    // statistic is bad; a fabricated phone number and address on a CONTACT page
    // tell a visitor to call a stranger.
    const src = stripComments(page);
    for (const fake of ['888', '123-4567', 'Impact Way', 'San Francisco', '94107']) {
      expect(src, `"${fake}" must not be hard-coded`).not.toContain(fake);
    }
  });

  it('ships no placeholder phone in the settings defaults either', () => {
    // general.supportPhone used to default to the (555) 123-4567 reserved
    // fiction, which would have rendered as a real-looking number.
    expect(DEFAULTS.general.supportPhone).toBe('');
    expect(DEFAULTS.general.officeAddress).toBe('');
  });

  it('rejects the known placeholders as firmly as an empty value', () => {
    for (const bad of ['', '   ', '+1 (555) 123-4567', '+1 (888) 123-4567', '555.123.4567', '123 Impact Way, Suite 400']) {
      expect(usableContactValue(bad), `"${bad}" must not be usable`).toBeNull();
    }
    expect(usableContactValue('+44 20 7946 0000')).toBe('+44 20 7946 0000');
    expect(usableContactValue('12 Real Street, Leeds')).toBe('12 Real Street, Leeds');
  });

  it('renders the phone and address only when configured', () => {
    expect(page).toContain('{details.phone && (');
    expect(page).toContain('{details.address && (');
  });

  it('takes the email from the settings the footer already uses', () => {
    // That address is a live mailto: on every page of the site, so it is real.
    expect(loader).toContain('getFooterSettings');
    expect(page).toContain('mailto:${details.email}');
  });
});

describe('measured figures, or an em dash', () => {
  it('never reports a failed read as a confident number', () => {
    expect(formatContactCount(null)).toBe('—');
  });

  it('reports a measured zero as zero, not as a marketing claim', () => {
    // The previous formatter returned the string '24/7' for a count of 0, so a
    // platform with no resolved cases advertised round-the-clock support.
    expect(formatContactCount(0)).toBe('0');
    expect(stripComments(page)).not.toContain('24/7');
  });

  it('formats real counts', () => {
    expect(formatContactCount(592)).toBe('592');
    expect(formatContactCount(12_400)).toBe('12K');
    expect(formatContactCount(2_400_000)).toBe('2.4M');
  });

  it('publishes no response-time figure, because none is measurable', () => {
    // The old page computed one as `updated_at - created_at` over resolved
    // cases and produced 250 DAYS against production. That is an artifact:
    // `updated_at` moves on any edit, the rows are seeded with backdated
    // `created_at` only, and `resolved_at` — the column that would be right —
    // is NULL on all 186 resolved cases.
    const src = stripComments(page) + stripComments(loader);
    expect(src).not.toContain('avgResponseHours');
    expect(src).not.toContain('formatResponseTime');
    expect(stripComments(page)).not.toContain('typically reply within');
  });

  it('counts cases exactly rather than sampling rows to count them', () => {
    // A head-only `count: 'exact'` transfers no rows, so it is both bounded and
    // exact — strictly better than the 500-row read it replaced.
    expect(loader).toContain("count: 'exact', head: true");
    expect(loader).toContain(".in('status', ['resolved', 'closed'])");
  });

  it('caps the one read that is proportional to the whole platform', () => {
    // unbounded-reads.test.ts treats any filter as bounding, which is true of
    // .eq('user_id', …) and NOT true of a status filter: .eq('status',
    // 'completed') on donations selects nearly every row that exists.
    expect(loader).toContain('.limit(DONOR_SAMPLE)');
  });

  it('treats a query error as unknown rather than as zero', () => {
    expect(loader).toContain('return NO_STATS;');
  });
});

describe('no channel is labelled as something it does not do', () => {
  it('dropped the chat link that opened an email client', () => {
    // "Live Chat / Start Chat" pointed at a mailto:. There is no chat widget on
    // this site.
    const src = stripComments(page);
    expect(src).not.toContain('Live Chat');
    expect(src).not.toContain('Start Chat');
    expect(src).not.toContain('mailto:hello@');
  });

  it('dropped "Join Community", which pointed at a read-only story index', () => {
    const src = stripComments(page);
    expect(src).not.toContain('Join Community');
  });

  it('every remaining channel points at a real internal route', () => {
    for (const href of ['/help', '/trust-safety', '/fees']) {
      expect(page, `channel must link to ${href}`).toContain(`href: '${href}'`);
    }
  });
});

describe('the FAQ is real Supabase content', () => {
  it('reads aeo_entries through the shared loader rather than JSX copy', () => {
    // The five questions were previously hard-coded here — a sixth copy of the
    // /faq content, and one already disagreed with /fast-payouts about how long
    // a payout takes.
    expect(page).toContain("getRouteFaqs('/contact'");
    expect(stripComments(page)).not.toContain('const FAQS');
  });

  it('renders no accordion at all when there is nothing to show', () => {
    expect(faqUi).toContain('if (faqs.length === 0) return null;');
  });

  it('uses native details/summary rather than a hand-rolled control', () => {
    const rendered = stripComments(faqUi);
    expect(rendered).toContain('<details');
    expect(rendered).toContain('<summary>');
    expect(rendered).not.toContain('aria-expanded');
    expect(rendered).not.toContain("'use client'");
  });
});

describe('the form still does what it says', () => {
  it('opens a real support ticket', () => {
    // Restyled, not rewritten. The endpoint is the thing that makes the page's
    // central claim true.
    expect(form).toContain("fetch('/api/support-tickets'");
    expect(form).toContain('ticketId');
  });

  it('was restyled onto the shared design language', () => {
    expect(form).toContain('className="ct-form"');
    expect(form).not.toContain('contact-form-card-v2');
  });

  it('leaves /newsletter\'s copy of the old form styling alone', () => {
    // /newsletter reuses those exact class names. Deleting them as "dead CSS"
    // would have silently unstyled that page.
    const css = read('app/globals.css');
    const newsletter = read('app/newsletter/NewsletterForm.tsx');
    for (const cls of ['contact-form-card-v2', 'contact-form-head', 'contact-privacy-v2']) {
      expect(newsletter, `${cls} is used by /newsletter`).toContain(cls);
      expect(css, `${cls} must keep its styling`).toContain(`.${cls}`);
    }
  });
});

describe('icons resolve to real glyphs', () => {
  it('every PublicIcon name used on the page exists in the icon map', () => {
    // PublicIcon falls back to the sparkle for an unknown name WITHOUT
    // erroring, so a typo ships the wrong glyph silently.
    const known = new Set([...icons.matchAll(/^\s{4}([a-z]+):/gm)].map((m) => m[1]));
    expect(known.size).toBeGreaterThan(10);
    const src = stripComments(page);
    const used = [...src.matchAll(/PublicIcon name=\{?['"]?([a-z]+)['"]/g)].map((m) => m[1]);
    const fromData = [...src.matchAll(/^\s*icon: '([a-z]+)',/gm)].map((m) => m[1]);
    const all = [...new Set([...used, ...fromData])];
    expect(all.length).toBeGreaterThan(3);
    for (const name of all) {
      expect(known.has(name), `icon "${name}" is not in PublicIcon`).toBe(true);
    }
  });
});
