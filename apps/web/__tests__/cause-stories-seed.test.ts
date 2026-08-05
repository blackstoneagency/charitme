import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAUSES } from '../lib/causes';

const SEED = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'seed', 'cause_stories.sql'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// The seed is content, so the things that can silently rot are: a cause slug
// that no longer exists (the story becomes unreachable), a duplicate title (the
// `on conflict do nothing` guard makes this look fine while dropping rows), and
// a `video_url` sneaking in that plays nothing.
// ─────────────────────────────────────────────────────────────────────────────

const rows = [...SEED.matchAll(/^ {2}\('([a-z-]+)', '((?:[^']|'')+)'/gm)]
  .map((m) => ({ slug: m[1], title: m[2].replace(/''/g, "'") }));

describe('cause_stories seed', () => {
  it('has the volume it claims', () => {
    expect(rows.length).toBeGreaterThanOrEqual(100);
  });

  it('every title is unique', () => {
    // `on conflict do nothing` would swallow duplicates, so a repeated title
    // silently seeds fewer rows than the file appears to contain.
    const dupes = rows.map((r) => r.title).filter((t, i, a) => a.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it('every cause_slug is a real cause', () => {
    const known = new Set(CAUSES.map((c) => c.slug));
    const unknown = [...new Set(rows.map((r) => r.slug))].filter((s) => !known.has(s));
    expect(unknown, 'seeded story points at a cause that does not exist').toEqual([]);
  });

  it('covers every cause, so no landing page falls back', () => {
    const seeded = new Set(rows.map((r) => r.slug));
    const missing = CAUSES.map((c) => c.slug).filter((s) => !seeded.has(s));
    expect(missing).toEqual([]);
  });

  it('reproduces the three cards the Sports & Youth design draws', () => {
    const sy = rows.filter((r) => r.slug === 'sports-youth').map((r) => r.title);
    for (const t of ['From Underdog to Team Captain', 'Stronger Together', 'Building More Than Athletes']) {
      expect(sy, `reference card "${t}" missing from the seed`).toContain(t);
    }
  });

  it('seeds NO video_url', () => {
    // A placeholder URL would restore the play control and have it play
    // nothing — the fake affordance cause_stories exists to remove. Videos are
    // added by the owner, per the header comment.
    //
    // ⚠️ SQL comments are stripped first. Without that this guard fails against
    // its own subject: the header explains `storage.CharitMe.example` as the
    // reason videos are not seeded, and a bare `/\.example/` matched the
    // explanation. Punishing a file for documenting itself pushes the next
    // author to delete the reasoning instead of the defect.
    const code = SEED.replace(/^\s*--.*$/gm, '');
    expect(code).not.toMatch(/video_url/);
    expect(code).not.toMatch(/\.example/);
  });
});
