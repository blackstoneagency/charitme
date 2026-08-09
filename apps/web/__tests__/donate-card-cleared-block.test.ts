import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The donate card's frequency toggle used to be followed by three blocks before
// the preset amounts: a "0% mandatory platform fee" callout (with a separate
// monthly variant in the same slot), a reward-tier picker, and an AI donor
// nudge. All three were removed on request — the card goes toggle → amounts.
//
// Asserted against SOURCE rather than a render because this repo's vitest
// config only collects `__tests__/**/*.test.ts`, so no component here can be
// unit-rendered. The rendered result was verified separately against a
// populated build: the embed donate card returns 200 and contains "Choose an
// amount", "Give Once" and "MOST POPULAR" while containing none of the strings
// below — i.e. the card renders and the block is gone, not the card missing.

const WEB_ROOT = join(__dirname, '..');
const DONATE_BUTTON = join(WEB_ROOT, 'app', 'campaigns', '[slug]', 'DonateButton.tsx');
const source = readFileSync(DONATE_BUTTON, 'utf8');
// Comments explain WHY the block is gone and naturally quote what it said, so
// they must not satisfy the assertions that the copy is absent.
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the donate card keeps the block between toggle and amounts empty', () => {
  // Non-vacuous: if the file were renamed or emptied, every "absent" assertion
  // below would pass trivially.
  it('is reading the real donate card', () => {
    expect(code).toContain('Choose an amount');
    expect(code).toContain('Give Once');
    expect(code).toContain('MOST POPULAR');
    expect(code.length).toBeGreaterThan(5_000);
  });

  it('renders no platform-fee callout, in either frequency', () => {
    expect(code).not.toMatch(/mandatory platform fee/i);
    // The monthly variant sat in the same slot and said it differently.
    expect(code).not.toMatch(/100% reaches the campaign/i);
  });

  it('renders no reward-tier picker', () => {
    expect(code).not.toMatch(/select a reward/i);
    expect(code).not.toMatch(/donate without a perk/i);
    // The picker was the only thing that could set a reward, so the prop, the
    // state and the checkout field all went with it. A `rewardId` here again
    // would mean something can select one that the donor cannot see.
    expect(code).not.toMatch(/selectedRewardId/);
    expect(code).not.toMatch(/rewardId/);
  });

  it('renders no AI donor nudge', () => {
    expect(code).not.toMatch(/aiNudge/);
  });

  // The same fetch supplies the suggested preset amounts, which sit OUTSIDE the
  // removed block — deleting it would quietly drop campaign-tuned asks.
  it('still asks the donor-conversion endpoint for suggested amounts', () => {
    expect(code).toContain('/api/ai/donor-conversion');
    expect(code).toContain('setPresets');
  });
});

describe('the campaign page no longer queries rewards it cannot show', () => {
  const detail = readFileSync(
    join(WEB_ROOT, 'app', 'campaigns', '[slug]', '(detail)', 'page.tsx'),
    'utf8',
  );

  it('is reading the real campaign page', () => {
    expect(detail).toContain('<DonateButton');
    expect(detail.length).toBeGreaterThan(5_000);
  });

  it('does not fetch campaign_rewards for a picker that is gone', () => {
    expect(detail).not.toContain('campaign_rewards');
    expect(detail).not.toContain('getRewards');
    expect(detail).not.toMatch(/rewards=\{/);
  });
});
