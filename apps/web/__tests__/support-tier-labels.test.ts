import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  SUGGESTED_SUPPORT_PERCENT,
  SUPPORT_TIER_PERCENTS,
  DEFAULT_DONATION_CHECKOUT_SETTINGS,
  normalizeDonationCheckoutSettings,
} from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// The suggested donor support rate is 10%, and the tier labels name the rate
// they belong to.
//
// ⚠️ The labels used to be a POSITIONAL array indexed against
// `checkout.supportTierPercents`, which is loaded from `platform_settings` and
// editable from /admin/super/settings. Inserting, removing or reordering one
// tier slid every label along by one, so "Recommended" would have appeared
// under whatever percentage landed in that slot — a specific, checkable claim
// attached to the wrong number, with nothing failing.
//
// Two separate things are asserted here because they can drift apart:
//   · the DEFAULT (what a donor gets without touching anything), and
//   · the LABEL (what the card calls each rate).
// ─────────────────────────────────────────────────────────────────────────────

const WEB = path.join(__dirname, '..');
const donateCard = readFileSync(
  path.join(WEB, 'app', 'campaigns', '[slug]', 'DonateButton.tsx'),
  'utf8',
);
const migration = readFileSync(
  path.join(WEB, '..', '..', 'supabase', 'migrations', '20260904000000_default_support_percent_ten.sql'),
  'utf8',
);

describe('the suggested support rate is 10%', () => {
  it('is the shared default, and is a rung a donor can actually see', () => {
    expect(SUGGESTED_SUPPORT_PERCENT).toBe(10);
    // A default that is not on the ladder renders as no tier selected at all.
    expect(SUPPORT_TIER_PERCENTS).toContain(SUGGESTED_SUPPORT_PERCENT);
    expect(DEFAULT_DONATION_CHECKOUT_SETTINGS.defaultSupportPercent).toBe(10);
  });

  it('does not shrink the ladder — 15% is still offered, just not preselected', () => {
    expect(SUPPORT_TIER_PERCENTS).toContain(15);
    expect(SUPPORT_TIER_PERCENTS[0]).toBe(15);
  });

  it('falls back to the suggested rate, never to the largest tier', () => {
    // A malformed stored value used to land on supportTierPercents[0] — the
    // ladder is sorted high → low, so that silently preselected the BIGGEST
    // optional fee. Invisible while both numbers were 15.
    const settings = normalizeDonationCheckoutSettings({
      supportTierPercents: [...SUPPORT_TIER_PERCENTS],
      defaultSupportPercent: 99,
    });
    expect(settings.defaultSupportPercent).toBe(10);
    expect(settings.defaultSupportPercent).not.toBe(15);
  });
});

describe('the donate card labels each rate, not each slot', () => {
  it('keys the presentation map by percent', () => {
    // The positional form took an index; the keyed form takes the percent.
    expect(donateCard).toContain('TIP_TIER_PRESENTATION[p] ?? TIP_TIER_FALLBACK');
    expect(donateCard).not.toMatch(/TIP_TIER_PRESENTATION\[index\]/);
  });

  it('calls 10% Recommended and 15% Incredible!', () => {
    expect(donateCard).toMatch(/\b10:\s*\{\s*label:\s*'Recommended'/);
    expect(donateCard).toMatch(/\b15:\s*\{\s*label:\s*'Incredible!'/);
    // The label that moved off 10% must not still be sitting there.
    expect(donateCard).not.toMatch(/\b10:\s*\{\s*label:\s*'Good'/);
  });

  it('keeps the rest of the ladder labelled', () => {
    for (const [percent, label] of [
      [12, 'Great'], [8, 'Nice'], [5, 'Thanks'],
      [3, 'Little bit'], [1, 'Any help counts'], [0, 'No fee'],
    ] as const) {
      expect(donateCard, `${percent}% lost its label`)
        .toMatch(new RegExp(`\\b${percent}:\\s*\\{\\s*label:\\s*'${label}'`));
    }
  });

  it('names every tier an admin could configure', () => {
    // Not a style point: a percent with no entry renders a blank label, and
    // borrowing a neighbour's would be a false claim about the rate.
    expect(donateCard).toContain('TIP_TIER_FALLBACK');
    for (const percent of SUPPORT_TIER_PERCENTS) {
      expect(donateCard, `${percent}% has no presentation entry`)
        .toMatch(new RegExp(`\\b${percent}:\\s*\\{\\s*label:`));
    }
  });
});

describe('the custom support amount control', () => {
  it('reads "Use $"', () => {
    expect(donateCard).toContain('Use $');
    expect(donateCard).not.toContain('Use %');
  });
});

describe('the stored default is migrated, not just the code default', () => {
  it('rewrites platform_settings so the live card matches the constant', () => {
    // lib/donation-checkout-settings.ts prefers the stored value, so changing
    // the constant alone moves a fresh database and leaves production alone.
    expect(migration).toMatch(/payment,donationCheckout,defaultSupportPercent/);
    expect(migration).toContain('to_jsonb(10)');
  });

  it('only overwrites the seeded 15, so an owner-chosen rate survives', () => {
    // The value is editable from /admin/super/settings. An unconditional
    // update would silently discard a deliberate decision — and would stop
    // being idempotent.
    expect(migration).toMatch(/where[\s\S]*defaultSupportPercent[\s\S]*=\s*to_jsonb\(15\)/i);
  });

  it('deletes nothing', () => {
    expect(migration).not.toMatch(/\bdelete\b/i);
    expect(migration).not.toMatch(/\bdrop\b/i);
  });
});
