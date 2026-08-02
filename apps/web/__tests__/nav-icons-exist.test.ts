import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allDashboardNavigation } from '../lib/persona-navigation';

// ─────────────────────────────────────────────────────────────────────────────
// `KFIcon` ends with `paths[name] ?? paths.home`, so an icon name that does not
// exist renders a HOUSE rather than nothing. That is worse than a blank: it is
// confidently wrong, and it looks deliberate.
//
// Caught for real: a new "Events" nav entry was given `icon: 'calendar'`, which
// the registry did not have. It rendered a house next to Events and no test,
// type or lint rule noticed — `icon` is typed `string`.
// ─────────────────────────────────────────────────────────────────────────────

function registeredIconNames(): Set<string> {
  const source = readFileSync(join(__dirname, '..', 'components', 'CharitMeApp.tsx'), 'utf8');
  const block = /const paths: Record<string, React\.ReactNode> = \{([\s\S]*?)\n  \};/.exec(source);
  expect(block, 'the KFIcon path registry moved or was renamed').toBeTruthy();
  const names = new Set<string>();
  for (const m of block![1].matchAll(/^\s{4}([a-zA-Z]+):/gm)) names.add(m[1]);
  return names;
}

describe('every navigation icon exists in the registry', () => {
  it('finds a real registry', () => {
    const names = registeredIconNames();
    expect(names.size).toBeGreaterThan(15);
    expect(names.has('home')).toBe(true);
  });

  it('has an icon for every persona navigation entry', () => {
    const names = registeredIconNames();
    const missing = allDashboardNavigation()
      .filter((item) => !names.has(item.icon))
      .map((item) => `${item.label} → icon:'${item.icon}'`);
    expect(
      missing,
      'KFIcon falls back to the HOUSE icon for an unknown name, so these render ' +
      `confidently wrong rather than blank:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('would catch a bogus icon name', () => {
    // The guard is only worth having if it can fail.
    expect(registeredIconNames().has('definitely-not-an-icon')).toBe(false);
  });
});
