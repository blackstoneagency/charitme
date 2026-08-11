import { describe, it, expect } from 'vitest';
import {
  aggregateSupporters,
  supporterListRows,
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
    // This is the TARGETING view. One row per person is the point: two rows
    // would mail the same address twice. Naming them is safe here because the
    // only thing that reads this name is the greeting on the email sent to that
    // very person — it is never shown to the organizer. `supporterListRows`
    // below is what the organizer sees, and it does not merge these.
    const s = aggregateSupporters([
      don({ anonymous: true, created_at: iso(10) }),
      don({ anonymous: false, name: 'Jane Doe', created_at: iso(2) }),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].name).toBe('Jane Doe');
    expect(s[0].anonymous).toBe(false);
  });
});

describe('supporterListRows — what the organizer actually sees', () => {
  it('never puts anonymous money on a named row', () => {
    // The bug: merged, this read "Jane Doe · 2 gifts · $525". The public donor
    // wall shows Jane's $25 openly, so the organizer could subtract and learn
    // she also gave $500 anonymously — the one thing the checkbox promised.
    const rows = supporterListRows([
      don({ anonymous: true, amount_cents: 50000, created_at: iso(10) }),
      don({ anonymous: false, amount_cents: 2500, created_at: iso(2) }),
    ]);
    expect(rows).toHaveLength(2);
    const named = rows.find(r => !r.anonymous)!;
    const hidden = rows.find(r => r.anonymous)!;
    expect(named.name).toBe('Jane Doe');
    expect(named.giftCount).toBe(1);
    expect(named.totalCents).toBe(2500);
    expect(hidden.name).toBe('Anonymous donor');
    expect(hidden.giftCount).toBe(1);
    expect(hidden.totalCents).toBe(50000);
  });

  it('leaves no field that rejoins the two rows', () => {
    // Splitting the rows is worthless if either half carries the donor's id or
    // masked address — the organizer just reads both and pairs them up.
    const rows = supporterListRows([
      don({ anonymous: true, amount_cents: 50000 }),
      don({ anonymous: false, amount_cents: 2500 }),
    ]);
    const hidden = rows.find(r => r.anonymous)!;
    expect(hidden.emailMasked).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain('u1');            // donor_id
    expect(JSON.stringify(hidden)).not.toContain('jane');          // email local part
    expect(rows.some(r => r.key === hidden.key && r !== hidden)).toBe(false);
  });

  it('still marks an anonymous supporter reachable', () => {
    // They can be emailed through the engage flow, which addresses the donor
    // directly. Reporting them unreachable would make the send counts look
    // wrong and hide real supporters from the organizer.
    const [row] = supporterListRows([don({ anonymous: true })]);
    expect(row.reachable).toBe(true);
    expect(row.emailMasked).toBeNull();
  });

  it('masks the address on a named row, and drops it when there is none', () => {
    // Guards the guard: if emailMasked were null everywhere, the assertions
    // above would pass while the organizer lost every address they may see.
    const [named] = supporterListRows([don({ anonymous: false })]);
    expect(named.emailMasked).toBe('ja***@ex***.com');
    const [offline] = supporterListRows([don({ donor_id: 'off1', email: null, name: 'Cash Donor' })]);
    expect(offline.emailMasked).toBeNull();
    expect(offline.reachable).toBe(false);
  });

  it('keeps collapsing repeat gifts within each half', () => {
    const older = iso(40);
    const newer = iso(35);
    const rows = supporterListRows([
      don({ anonymous: true, amount_cents: 1000, created_at: older }),
      don({ anonymous: true, amount_cents: 2000, created_at: newer }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].giftCount).toBe(2);
    expect(rows[0].totalCents).toBe(3000);
    expect(rows[0].isRepeat).toBe(true);
    expect(rows[0].isLapsed).toBe(true);
    expect(rows[0].lastGiftAt).toBe(newer);
  });

  it('skips the unreachable guest and sorts by value', () => {
    const rows = supporterListRows([
      don({ donor_id: null, email: null, name: null, amount_cents: 9999 }),
      don({ donor_id: 'a', amount_cents: 1000 }),
      don({ donor_id: 'b', amount_cents: 9000 }),
    ]);
    expect(rows.map(r => r.totalCents)).toEqual([9000, 1000]);
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
