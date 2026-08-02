import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The newsletter page was recorded in todo.md as unbuildable — "no subscriber
// table, needs DDL, which is blocked". A table did exist. These tests hold the
// page to being genuinely wired rather than a form that posts into nothing,
// which is the failure mode that note was worried about.

const rateLimit = vi.fn(async () => true);
const resolveContact = vi.fn(async () => 'contact-1');
const trackEvent = vi.fn(async () => true);
const resubscribeEmail = vi.fn(async () => undefined);

vi.mock('../lib/rate-limit-durable', () => ({ checkRateLimitDurable: (...a: unknown[]) => rateLimit(...(a as [])) }));
vi.mock('../lib/marketing-engine', () => ({
  resolveContact: (...a: unknown[]) => resolveContact(...(a as [])),
  trackEvent: (...a: unknown[]) => trackEvent(...(a as [])),
  resubscribeEmail: (...a: unknown[]) => resubscribeEmail(...(a as [])),
  refreshContactScores: async () => undefined,
}));
vi.mock('../lib/supabase', () => ({ supabaseAdmin: {} }));

import { POST } from '../app/api/marketing/capture/route';

function request(body: unknown) {
  return new Request('https://www.charitme.com/api/marketing/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

describe('newsletter capture', () => {
  beforeEach(() => {
    rateLimit.mockClear();
    resolveContact.mockClear();
    trackEvent.mockClear();
    resubscribeEmail.mockClear();
    rateLimit.mockResolvedValue(true);
  });

  it('also clears the suppression list, which is the other half of an unsubscribe', () => {
    // `unsubscribeEmail` writes TWO things: contact status AND a row in
    // marketing_suppression_list. Every send path (campaigns, automations,
    // outreach) checks isSuppressed() independently of status, so undoing only
    // the status leaves the symptom — receives nothing — completely unchanged.
    return POST(request({ email: 'back@example.com', consentEmail: true })).then(() => {
      expect(resubscribeEmail).toHaveBeenCalledWith('back@example.com');
    });
  });

  it('never touches suppression without an explicit opt-in', async () => {
    await POST(request({ email: 'browsing@example.com' }));
    await POST(request({ email: 'declined@example.com', consentEmail: false }));
    expect(resubscribeEmail).not.toHaveBeenCalled();
  });

  it('an explicit opt-in re-activates someone who previously unsubscribed', async () => {
    // The bug this pins: the route wrote a fresh consent row and returned 200
    // while leaving the contact at status 'unsubscribed', so the subscriber saw a
    // confirmation and then received nothing, forever, with no way to tell.
    // resolveContact only ever UPGRADES on 'active', so passing it is safe.
    const res = await POST(request({ email: 'reader@example.com', clientType: 'newsletter', consentEmail: true }));
    expect(res.status).toBe(200);
    expect(resolveContact).toHaveBeenCalledWith(expect.objectContaining({ marketingStatus: 'active' }));
  });

  it('does not send a status when consent was not explicitly granted', async () => {
    // A capture WITHOUT consent must not flip anyone to emailable, and must not
    // downgrade them either — it simply says nothing about status.
    await POST(request({ email: 'browsing@example.com' }));
    expect(resolveContact).toHaveBeenCalledWith(expect.objectContaining({ marketingStatus: undefined }));

    resolveContact.mockClear();
    await POST(request({ email: 'declined@example.com', consentEmail: false }));
    expect(resolveContact).toHaveBeenCalledWith(expect.objectContaining({ marketingStatus: undefined }));
  });

  it('records the opt-in in the consent log', async () => {
    await POST(request({ email: 'reader@example.com', consentEmail: true }));
    expect(resolveContact).toHaveBeenCalledWith(expect.objectContaining({ consentEmail: true }));
  });

  it('rate limits, because the endpoint is unauthenticated', async () => {
    rateLimit.mockResolvedValue(false);
    const res = await POST(request({ email: 'flood@example.com', consentEmail: true }));
    expect(res.status).toBe(429);
    expect(resolveContact).not.toHaveBeenCalled();
  });
});

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('the /newsletter page', () => {
  const form = read('app/newsletter/NewsletterForm.tsx');
  const page = read('app/newsletter/page.tsx');

  it('posts to the real capture endpoint as a newsletter contact', () => {
    expect(form).toContain('/api/marketing/capture');
    expect(form).toContain("clientType: 'newsletter'");
    expect(form).toContain('consentEmail: true');
  });

  it('does not reveal whether an address is already subscribed', () => {
    // The endpoint is open and unauthenticated, so a distinct "already
    // subscribed" reply would turn it into a membership oracle for any address.
    expect(form).not.toMatch(/already subscribed/i);
  });

  it('announces the result to assistive tech', () => {
    expect(form).toContain('aria-live="polite"');
  });

  it('claims no subscriber count, open rate or reader total', () => {
    // The design mock shows "join 40,000 readers". Nothing measures that, and
    // this repo's standing rule is that an unmeasured number is not rendered.
    const numbers = `${page} ${form}`.match(/\b\d{3,}(?:,\d{3})*\+?\s*(readers|subscribers)\b/gi);
    expect(numbers).toBeNull();
  });
});

describe('/guides', () => {
  it('redirects to /resources instead of being a second guide index', () => {
    // /resources is already design 22's listing. Two indexes over one set of
    // guides drift the day a guide is added to only one of them.
    const src = read('app/guides/page.tsx');
    expect(src).toContain("permanentRedirect('/resources')");
    expect(src).not.toContain('CardGrid');
  });
});

describe('resubscribeEmail', () => {
  it('clears ONLY an unsubscribe suppression, never a bounce or complaint', () => {
    // A 'bounced' row means the address is undeliverable; a 'complaint' means its
    // owner reported us as spam. Someone typing that address into a form is not
    // evidence either was resolved, and re-enabling sends on that basis damages
    // domain reputation for every other recipient. So the delete is narrowed by
    // reason — dropping that filter is the dangerous edit this guards.
    const src = readFileSync(resolve(__dirname, '..', 'lib/marketing-engine.ts'), 'utf8');
    const fn = src.slice(src.indexOf('export async function resubscribeEmail'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toContain("from('marketing_suppression_list')");
    expect(body).toContain('.delete()');
    expect(body).toContain(".eq('reason', 'unsubscribed')");
  });
});
