import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  conversionRate,
  describeShareImpact,
  MIN_SHARES_FOR_RATE,
  SHARE_TEMPLATES,
  buildTemplate,
  campaignShareUrl,
} from '../lib/share-page-core';

describe('conversionRate', () => {
  it('is null with no shares, not 0%', () => {
    // A campaign nobody has shared has not achieved a 0% rate — it has no rate.
    expect(conversionRate({ shares: 0, converted: 0 })).toBeNull();
  });

  it('rounds against total shares', () => {
    expect(conversionRate({ shares: 40, converted: 10 })).toBe(25);
  });
});

describe('describeShareImpact', () => {
  it('says nothing below the sample floor', () => {
    // "100% of shares led to a donation" off one share is technically true,
    // useless, and reads as fabricated — which costs more trust than silence.
    expect(describeShareImpact({ shares: 1, converted: 1 })).toBeNull();
    expect(describeShareImpact({ shares: MIN_SHARES_FOR_RATE - 1, converted: 5 })).toBeNull();
  });

  it('speaks once there is enough to quote', () => {
    const text = describeShareImpact({ shares: 40, converted: 10 });
    expect(text).toBe('25% of shares for this campaign have led to a donation.');
  });

  it('stays silent when the rate rounds to zero', () => {
    // "0% of shares have led to a donation" beside a share button is accurate
    // and actively discouraging. Nothing is better.
    expect(describeShareImpact({ shares: 500, converted: 0 })).toBeNull();
  });
});

describe('share templates', () => {
  it('composes a title containing an apostrophe without escaping at the call site', () => {
    const text = buildTemplate('personal', "Ali's surgery fund", 'https://x.test/c/a');
    expect(text).toContain("Ali's surgery fund");
    expect(text).toContain('https://x.test/c/a');
  });

  it('every template produces the title and the url', () => {
    for (const template of SHARE_TEMPLATES) {
      const text = template.build('Save the Bees', 'https://x.test/c/bees');
      expect(text, `${template.id} must name the campaign`).toContain('Save the Bees');
      expect(text, `${template.id} must carry the link`).toContain('https://x.test/c/bees');
    }
  });

  it('makes no claim about the campaign beyond its title', () => {
    // A supporter sends these under their own name. None may assert an outcome,
    // a deadline, or a fact about the cause that the platform cannot stand behind.
    for (const template of SHARE_TEMPLATES) {
      const text = template.build('A Campaign', 'https://x.test').toLowerCase();
      for (const forbidden of ['urgent', 'last chance', 'act now', 'guarantee', 'dying', 'hours left']) {
        expect(text, `${template.id} must not use false urgency ("${forbidden}")`).not.toContain(forbidden);
      }
    }
  });

  it('the 0% fee claim it does make matches the shared source of truth', () => {
    // One template mentions the platform taking 0%. If PLATFORM_FEE_PERCENT ever
    // changes, this copy becomes a lie in a message a supporter sends personally.
    const fees = readFileSync(join(__dirname, '..', '..', '..', 'packages', 'shared', 'fees.ts'), 'utf8');
    const match = /PLATFORM_FEE_PERCENT\s*=\s*(\d+)/.exec(fees);
    expect(match, 'PLATFORM_FEE_PERCENT moved').toBeTruthy();
    const claims = SHARE_TEMPLATES.filter((t) => t.build('x', 'y').includes('0%'));
    if (match![1] === '0') {
      expect(claims.length).toBeGreaterThan(0);
    } else {
      expect(claims, 'a template still claims 0% while the real fee is not 0').toEqual([]);
    }
  });

  it('returns null for an unknown template rather than an empty message', () => {
    expect(buildTemplate('nope', 'T', 'u')).toBeNull();
  });

  it('has no duplicate ids', () => {
    const ids = SHARE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('campaignShareUrl', () => {
  it('builds a bare campaign url with no channel', () => {
    expect(campaignShareUrl('https://x.test', 'bees')).toBe('https://x.test/campaigns/bees');
  });

  it('tolerates a trailing slash on the origin rather than doubling it', () => {
    expect(campaignShareUrl('https://x.test/', 'bees')).toBe('https://x.test/campaigns/bees');
  });

  it('carries attribution the webhook can read back', () => {
    const url = campaignShareUrl('https://x.test', 'bees', 'whatsapp');
    expect(url).toContain('utm_source=share-page');
    expect(url).toContain('utm_medium=whatsapp');
    expect(url).toContain('utm_campaign=bees');
  });

  it('uses a channel the share_events CHECK constraint allows', () => {
    // A channel outside the constraint would be refused at write time, so the
    // share would silently not be recorded and the link would arrive anonymous.
    const schema = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'schema.sql'), 'utf8');
    const match = /share_events_channel_check CHECK \(\(channel = ANY \(ARRAY\[([\s\S]*?)\]\)\)\)/.exec(schema);
    expect(match, 'the share_events channel CHECK moved').toBeTruthy();
    const allowed = [...match![1].matchAll(/'([a-z]+)'::text/g)].map((m) => m[1]);
    for (const channel of ['facebook', 'twitter', 'linkedin', 'whatsapp', 'email', 'link']) {
      expect(allowed, `${channel} must be writable`).toContain(channel);
    }
  });
});
