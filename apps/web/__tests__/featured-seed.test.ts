import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAUSES } from '../lib/causes';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, '..', '..', '..', 'supabase', 'seed', 'featured_campaigns.sql'),
  'utf8',
);

// ─────────────────────────────────────────────────────────────────────────────
// The seed that flags a few campaigns per cause as featured.
//
// It is checked in rather than run by an agent because this sandbox holds no
// Supabase credentials — but that makes it MORE important to guard, not less:
// nobody reviews a .sql file the way they review a diff, and this one writes to
// production campaign rows.
//
// The danger it must never grow into: `campaigns.featured` is ALSO set by the
// Stripe webhook when a creator pays for homepage-rotator placement. Nothing in
// the schema distinguishes a paid flag from a staff-set one, so any statement
// that clears the column in bulk silently voids something people bought.
// ─────────────────────────────────────────────────────────────────────────────

/** The category list inside the `c.category in ( … )` clause. */
function seededCategories(): string[] {
  const block = sql.slice(sql.indexOf('c.category in ('));
  const inner = block.slice(block.indexOf('(') + 1, block.indexOf(')'));
  return [...inner.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('the featured seed can never un-feature a paid placement', () => {
  it('never sets the flag to false', () => {
    // The single most damaging edit this file could receive is a "reset first"
    // line. Every creator who paid would lose what they bought, with no record
    // that they had.
    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements, 'a bulk clear would void paid placements').not.toMatch(
      /set\s+featured\s*=\s*false/i,
    );
  });

  it('contains no delete or truncate at all', () => {
    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements).not.toMatch(/\bdelete\s+from\b/i);
    expect(statements).not.toMatch(/\btruncate\b/i);
  });

  it('touches only the campaigns table', () => {
    const written = [...sql.replace(/^\s*--.*$/gm, '').matchAll(/update\s+([\w.]+)/gi)].map(
      (m) => m[1],
    );
    expect(written).toEqual(['public.campaigns']);
  });

  it('is idempotent — a second run changes nothing', () => {
    // Without this the `returning` list would repeat rows that were already
    // featured, and the list is the only undo record there is.
    expect(sql).toMatch(/featured is distinct from true/);
  });

  it('reports what it changed, which is the only undo record', () => {
    expect(sql).toMatch(/returning\s+t\.id/);
  });
});

describe('the seed only ever features a campaign a visitor can act on', () => {
  it('excludes expired campaigns, with the same boundary as the app', () => {
    // `>` not `>=` — a deadline of today has already arrived, which is what
    // `campaignLifecycle` renders as "Ended". A featured card reading "Ended"
    // would be the exact defect the cause-page work just removed.
    expect(sql).toMatch(/c\.deadline is null or c\.deadline > now\(\)/);
    expect(sql).not.toMatch(/c\.deadline >= now\(\)/);
  });

  it('excludes private and soft-deleted campaigns', () => {
    expect(sql).toMatch(/c\.status = 'active'/);
    expect(sql).toMatch(/c\.visibility = 'public'/);
    expect(sql).toMatch(/c\.deleted_at is null/);
  });

  it('excludes fully funded campaigns, matching hasReachedGoal', () => {
    // A funded campaign in a promoted slot takes it from one that still needs
    // money — the same reason `isRotatorEligible` drops them from the hero.
    expect(sql).toMatch(/coalesce\(c\.raised_amount, 0\) < c\.goal_amount/);
    // …but a null/zero goal means "no target set", which can never be reached.
    expect(sql).toMatch(/c\.goal_amount is null/);
  });
});

describe('the seed covers every cause page, and cannot drift from the causes', () => {
  const seeded = seededCategories();

  it('features a bounded number per category, not the whole table', () => {
    expect(sql).toMatch(/e\.rank <= 2/);
  });

  it('covers every category every cause draws on', () => {
    // If a cause gains a category and this list is not updated, that cause page
    // gets no featured campaign and the omission is invisible on the page.
    const needed = new Set(CAUSES.flatMap((c) => c.categories as readonly string[]));
    for (const cat of needed) {
      expect(seeded, `no cause page covering "${cat}" would get a featured campaign`).toContain(
        cat,
      );
    }
  });

  it('so every one of the 20 causes gets at least one', () => {
    // The property that actually matters, asserted directly rather than
    // inferred from the category list above.
    for (const cause of CAUSES) {
      const covered = cause.categories.some((c) => seeded.includes(c));
      expect(covered, `/causes/${cause.slug} would show no featured campaign`).toBe(true);
    }
  });

  it('names only real campaign categories', () => {
    // A typo here silently matches zero rows — the statement succeeds, reports
    // nothing, and the cause page looks unchanged.
    for (const cat of seeded) {
      expect(
        (CAMPAIGN_CATEGORIES as readonly string[]).includes(cat),
        `"${cat}" is not a real campaign category, so it would match no rows`,
      ).toBe(true);
    }
  });
});
