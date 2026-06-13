import { describe, it, expect } from 'vitest';
import {
  aggregateSupporters,
  filterTargets,
  sendsRemainingToday,
  personalize,
  maskEmail,
  ORGANIZER_TEMPLATES,
  MAX_SENDS_PER_CAMPAIGN_PER_DAY,
  type DonationRow,
} from '../lib/organizer-marketing';

const day = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * day).toISOString();

const don = (over: Partial<DonationRow>): DonationRow => ({
  donor_id: 'u1', amount_cents: 5000, created_at: iso(5), anonymous: false,
  email: 'jane@example.com', name: 'Jane Doe', ...over,
});

describe('aggregateSupporters', () => {
  it('collapses multiple gifts into one supporter with repeat flag', () => {
    const s = aggregateSupporters([
      don({ created_at: iso(40), amount_cents: 2000 }),
      don({ created_at: iso(5), amount_cents: 3000 }),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].giftCount).toBe(2);
    expect(s[0].totalCents).toBe(5000);
    expect(s[0].isRepeat).toBe(true);
    expect(s[0].isLapsed).toBe(false); // last gift 5 days ago
  });

  it('flags lapsed after 30 days', () => {
    const s = aggregateSupporters([don({ created_at: iso(45) })]);
    expect(s[0].isLapsed).toBe(true);
    expect(s[0].daysSinceLastGift).toBeGreaterThanOrEqual(44);
  });

  it('keys guests by email and skips unreachable anonymous guests', () => {
    const s = aggregateSupporters([
      don({ donor_id: null, email: 'guest@x.com', name: null }),
      don({ donor_id: null, email: null, name: null }), // unreachable
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].key).toBe('guest@x.com');
  });

  it('sorts by lifetime value descending', () => {
    const s = aggregateSupporters([
      don({ donor_id: 'a', amount_cents: 1000 }),
      don({ donor_id: 'b', amount_cents: 9000 }),
    ]);
    expect(s[0].key).toBe('b');
  });

  it('anonymous flag clears when a later named gift arrives', () => {
    const s = aggregateSupporters([
      don({ anonymous: true, created_at: iso(10) }),
      don({ anonymous: false, name: 'Jane Doe', created_at: iso(2) }),
    ]);
    expect(s[0].name).toBe('Jane Doe');
    expect(s[0].anonymous).toBe(false);
  });
});

describe('filterTargets', () => {
  const supporters = aggregateSupporters([
    don({ donor_id: 'recent', created_at: iso(3) }),
    don({ donor_id: 'lapsed', created_at: iso(60) }),
    don({ donor_id: 'repeat', created_at: iso(50) }),
    don({ donor_id: 'repeat', created_at: iso(2) }),
    don({ donor_id: 'noemail', email: null, created_at: iso(1) }),
  ]);

  it('recent excludes lapsed; lapsed excludes recent', () => {
    expect(filterTargets(supporters, 'recent_donors').map(s => s.key).sort()).toEqual(['recent', 'repeat']);
    expect(filterTargets(supporters, 'lapsed_donors').map(s => s.key)).toEqual(['lapsed']);
  });

  it('one_time excludes repeat donors', () => {
    const keys = filterTargets(supporters, 'one_time_donors').map(s => s.key).sort();
    expect(keys).toEqual(['lapsed', 'recent']);
  });

  it('never targets supporters without an email', () => {
    expect(filterTargets(supporters, 'all_donors').every(s => s.email)).toBe(true);
  });
});

describe('sendsRemainingToday', () => {
  it('enforces the daily cap', () => {
    expect(sendsRemainingToday([])).toBe(MAX_SENDS_PER_CAMPAIGN_PER_DAY);
    const now = new Date().toISOString();
    expect(sendsRemainingToday([now])).toBe(MAX_SENDS_PER_CAMPAIGN_PER_DAY - 1);
    expect(sendsRemainingToday([now, now])).toBe(0);
    expect(sendsRemainingToday([now, now, now])).toBe(0); // never negative
  });

  it('yesterday sends do not count', () => {
    expect(sendsRemainingToday([iso(1), iso(2)])).toBe(MAX_SENDS_PER_CAMPAIGN_PER_DAY);
  });
});

describe('personalize', () => {
  it('replaces all variables', () => {
    const out = personalize('Hi {{first_name}}, re {{campaign_title}} at {{campaign_url}} — {{organizer_name}}', {
      firstName: 'Jane', campaignTitle: 'Help Max', campaignUrl: 'https://x.com/c', organizerName: 'Dan',
    });
    expect(out).toBe('Hi Jane, re Help Max at https://x.com/c — Dan');
  });
});

describe('templates', () => {
  it('every template has the required fields and valid default target', () => {
    for (const t of ORGANIZER_TEMPLATES) {
      expect(t.subject.length).toBeGreaterThan(5);
      expect(t.body).toContain('{{first_name}}');
      expect(['recent_donors', 'all_donors', 'lapsed_donors', 'one_time_donors']).toContain(t.defaultTarget);
    }
    expect(ORGANIZER_TEMPLATES).toHaveLength(4);
  });
});

describe('maskEmail', () => {
  it('masks local part and domain', () => {
    expect(maskEmail('jane.doe@gmail.com')).toBe('ja***@gm***.com');
    expect(maskEmail('a@b.io')).toBe('a***@b***.io');
  });
});
