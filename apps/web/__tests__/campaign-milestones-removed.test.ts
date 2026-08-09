import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');
const raw = read('app/campaigns/[slug]/(detail)/page.tsx');
/** Comments explain the removal and therefore NAME what was removed. */
const code = raw
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ─────────────────────────────────────────────────────────────────────────────
// The "🎯 Milestones & stretch goals" panel was removed from the public campaign
// page on request. A deleted section with no test is a section that quietly
// returns the next time somebody works from an older screenshot.
// ─────────────────────────────────────────────────────────────────────────────

describe('the milestones panel is gone from the campaign page', () => {
  it('renders no Milestones component', () => {
    expect(code).not.toMatch(/<Milestones/);
    expect(code).not.toMatch(/from '\.\.\/Milestones'/);
  });

  it('ships no component file for it', () => {
    expect(existsSync(join(here, '..', 'app', 'campaigns', '[slug]', 'Milestones.tsx'))).toBe(false);
  });

  it('does not read milestones it no longer displays', () => {
    // Leaving the fetch would pay for a query on every campaign page view and
    // discard the result.
    expect(code).not.toMatch(/getMilestones/);
    expect(code).not.toMatch(/campaign_milestones/);
  });

  it('ships no orphaned styles', () => {
    expect(read('app/globals.css')).not.toContain('pc-milestone');
  });
});

describe('the milestones FEATURE underneath is untouched', () => {
  // Only the public panel went. Deleting the organiser's ability to set
  // milestones is a different and much larger change than was asked for.
  it('keeps the organiser editor', () => {
    expect(existsSync(join(here, '..', 'app', 'dashboard', 'campaigns', '[id]', 'milestones', 'page.tsx'))).toBe(true);
  });

  it('keeps the API that writes them', () => {
    expect(existsSync(join(here, '..', 'app', 'api', 'campaigns', '[id]', 'milestones', 'route.ts'))).toBe(true);
  });
});
