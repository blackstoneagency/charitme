import { describe, expect, it } from 'vitest';
import {
  appendUtmParams,
  resolveRedirectUrl,
  generateShortCode,
  slugifyCampaignName,
  buildTrackingUrl,
} from '../lib/click-tracking';

describe('appendUtmParams', () => {
  const utm = { source: 'email', medium: 'campaign', campaign: 'summer-2026' };

  it('appends utm_* params onto a relative URL', () => {
    expect(appendUtmParams('/campaigns/help-mia', utm)).toBe(
      '/campaigns/help-mia?utm_source=email&utm_medium=campaign&utm_campaign=summer-2026',
    );
  });

  it('appends utm_* params onto an absolute URL', () => {
    expect(appendUtmParams('https://www.charitme.com/campaigns/help-mia', utm)).toBe(
      'https://www.charitme.com/campaigns/help-mia?utm_source=email&utm_medium=campaign&utm_campaign=summer-2026',
    );
  });

  it('does not overwrite params already present in the query string', () => {
    expect(appendUtmParams('/campaigns/help-mia?utm_source=existing', utm)).toBe(
      '/campaigns/help-mia?utm_source=existing&utm_medium=campaign&utm_campaign=summer-2026',
    );
  });

  it('includes optional term/content when provided', () => {
    expect(appendUtmParams('/p', { ...utm, term: 'donate', content: 'hero' })).toBe(
      '/p?utm_source=email&utm_medium=campaign&utm_campaign=summer-2026&utm_term=donate&utm_content=hero',
    );
  });

  it('omits null/undefined utm fields', () => {
    expect(appendUtmParams('/p', { source: 'email', medium: null, campaign: undefined })).toBe(
      '/p?utm_source=email',
    );
  });

  it('preserves existing query params and hash', () => {
    expect(appendUtmParams('/p?ref=abc#section', { source: 'email' })).toBe(
      '/p?ref=abc&utm_source=email#section',
    );
  });

  it('falls back to the original string on invalid input', () => {
    expect(appendUtmParams('http://', utm)).toBe('http://');
  });
});

describe('resolveRedirectUrl', () => {
  const origin = 'https://www.charitme.com';

  it('returns absolute URLs unchanged', () => {
    expect(resolveRedirectUrl('https://example.com/x', origin)).toBe('https://example.com/x');
  });

  it('resolves relative paths against the app origin', () => {
    expect(resolveRedirectUrl('/campaigns/help-mia?utm_source=email', origin)).toBe(
      'https://www.charitme.com/campaigns/help-mia?utm_source=email',
    );
  });

  it('falls back to the origin root on invalid input', () => {
    expect(resolveRedirectUrl('/campaigns/help-mia', 'not a valid origin')).toBe('not a valid origin/');
  });

  it('strips a trailing slash from the origin in the fallback', () => {
    expect(resolveRedirectUrl('/campaigns/help-mia', 'not a valid origin/')).toBe('not a valid origin/');
  });
});

describe('generateShortCode', () => {
  it('generates an 8-character lowercase alphanumeric code by default', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
  });

  it('respects a custom length', () => {
    expect(generateShortCode(12)).toHaveLength(12);
  });

  it('generates different codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateShortCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('slugifyCampaignName', () => {
  it('lowercases and hyphenates a campaign name', () => {
    expect(slugifyCampaignName('Summer Giving Push 2026')).toBe('summer-giving-push-2026');
  });

  it('strips punctuation and collapses repeated separators', () => {
    expect(slugifyCampaignName('New Leads -- Welcome!!')).toBe('new-leads-welcome');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugifyCampaignName('  --Re-Engagement--  ')).toBe('re-engagement');
  });

  it('falls back to "campaign" when nothing alphanumeric remains', () => {
    expect(slugifyCampaignName('!!!')).toBe('campaign');
  });
});

describe('buildTrackingUrl', () => {
  const origin = 'https://www.charitme.com';

  it('builds a /go/[code] URL with campaign and contact ids', () => {
    expect(buildTrackingUrl(origin, 'ab12cd34', 'camp-1', 'contact-1')).toBe(
      'https://www.charitme.com/go/ab12cd34?camp=camp-1&cid=contact-1',
    );
  });

  it('omits cid when no contactId is given (e.g. test sends)', () => {
    expect(buildTrackingUrl(origin, 'ab12cd34', 'camp-1')).toBe(
      'https://www.charitme.com/go/ab12cd34?camp=camp-1',
    );
  });
});
