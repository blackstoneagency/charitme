import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isDisplayable,
  sponsorLogoUrl,
  sponsorHref,
  displayableSponsors,
  type Sponsor,
} from '../lib/sponsors-core';

const sponsor = (over: Partial<Sponsor> = {}): Sponsor => ({
  id: 's1', name: 'UNICEF', logo_url: null, website: null, ...over,
});

describe('isDisplayable', () => {
  it('needs a logo or a website', () => {
    // A row with neither renders as a bare word in a logo strip, which reads as
    // a rendering bug rather than as a partner.
    expect(isDisplayable(sponsor())).toBe(false);
    expect(isDisplayable(sponsor({ logo_url: 'https://x.test/l.png' }))).toBe(true);
    expect(isDisplayable(sponsor({ website: 'https://unicef.org' }))).toBe(true);
  });

  it('ignores a stored logo that is not an absolute url', () => {
    expect(isDisplayable(sponsor({ logo_url: '/uploads/l.png' }))).toBe(false);
  });
});

describe('sponsorLogoUrl', () => {
  it('prefers a real uploaded logo', () => {
    expect(sponsorLogoUrl(sponsor({ logo_url: 'https://x.test/l.png', website: 'https://y.test' })))
      .toBe('https://x.test/l.png');
  });

  it('falls back to a favicon derived from the website', () => {
    const url = sponsorLogoUrl(sponsor({ website: 'https://www.unicef.org/uk' }));
    expect(url).toContain('www.unicef.org');
    expect(url).toContain('sz=128');
  });

  it('returns null rather than a broken image for a malformed website', () => {
    expect(sponsorLogoUrl(sponsor({ website: 'not a url' }))).toBeNull();
    expect(sponsorLogoUrl(sponsor())).toBeNull();
  });
});

describe('sponsorHref', () => {
  it('passes through http and https', () => {
    expect(sponsorHref(sponsor({ website: 'https://unicef.org/' }))).toBe('https://unicef.org/');
    expect(sponsorHref(sponsor({ website: 'http://unicef.org/' }))).toBe('http://unicef.org/');
  });

  it('refuses a javascript: or data: url', () => {
    // Administrator-entered is not the same as safe: a stored javascript: URL
    // would become a live link on a page anyone can open.
    expect(sponsorHref(sponsor({ website: 'javascript:alert(1)' }))).toBeNull();
    expect(sponsorHref(sponsor({ website: 'data:text/html,<script>' }))).toBeNull();
  });

  it('returns null for a malformed or absent website', () => {
    expect(sponsorHref(sponsor({ website: 'unicef.org' }))).toBeNull();
    expect(sponsorHref(sponsor())).toBeNull();
  });
});

describe('displayableSponsors', () => {
  it('keeps the order it was given, which is the admin sort order', () => {
    const list = [
      sponsor({ id: '1', website: 'https://a.test' }),
      sponsor({ id: '2' }),
      sponsor({ id: '3', logo_url: 'https://c.test/l.png' }),
    ];
    expect(displayableSponsors(list).map((s) => s.id)).toEqual(['1', '3']);
  });

  it('is empty for no sponsors, which is different from a read failure', () => {
    expect(displayableSponsors([])).toEqual([]);
  });
});

describe('the table this reads', () => {
  it('has the columns the reader selects', () => {
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    const match = /CREATE TABLE public\.sponsors \(([\s\S]*?)\n\);/.exec(schema);
    expect(match, 'sponsors moved or was renamed').toBeTruthy();
    for (const column of ['name', 'logo_url', 'website', 'active', 'sort_order']) {
      expect(match![1]).toContain(column);
    }
  });
});
