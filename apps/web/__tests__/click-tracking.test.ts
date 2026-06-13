import { describe, expect, it } from 'vitest';
import { appendUtmParams, resolveRedirectUrl } from '../lib/click-tracking';

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
