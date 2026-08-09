import { describe, expect, it } from 'vitest';
import {
  applyNavOverride,
  composeNavigation,
  parseNavOverride,
  parseNavOverrideMap,
  type NavItemLike,
} from '../lib/nav-customization-core';

const NAV: NavItemLike[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'home' },
  { label: 'Giving History', href: '/donor', icon: 'gift' },
  { label: 'Saved Causes', href: '/dashboard/saved', icon: 'heart' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'gear' },
];

describe('parsing untrusted override JSON', () => {
  it('treats anything unrecognised as no customization', () => {
    // These all arrive from a settings blob or a database column, so none of
    // them may throw — this runs on every signed-in page render.
    for (const raw of [null, undefined, 42, 'x', [], { hidden: 'nope' }, { order: {} }]) {
      expect(parseNavOverride(raw)).toEqual({});
    }
  });

  it('keeps only non-empty string entries', () => {
    expect(parseNavOverride({ hidden: ['/a', '', 7, null, '/b'] })).toEqual({ hidden: ['/a', '/b'] });
    // An array that contains nothing usable is the same as no key at all.
    expect(parseNavOverride({ hidden: ['', 7] })).toEqual({});
  });

  // Every structured value in platform_settings.config is stored STRINGIFIED,
  // so an object-only parser would silently ignore a setting the Super Admin
  // really had saved — no error, the setting just does nothing.
  it('accepts the stringified form settings are actually stored in', () => {
    const asString = JSON.stringify({ donor: { hidden: ['/donor'] } });
    expect(parseNavOverrideMap(asString)).toEqual({ donor: { hidden: ['/donor'] } });
    expect(parseNavOverrideMap('not json')).toEqual({});
    expect(parseNavOverrideMap('[]')).toEqual({});
  });

  it('parses a role map and drops roles with nothing to say', () => {
    const map = parseNavOverrideMap({
      donor: { hidden: ['/donor'] },
      organizer: { hidden: [] },
      nonprofit: 'garbage',
    });
    expect(map).toEqual({ donor: { hidden: ['/donor'] } });
  });
});

describe('applying one override layer', () => {
  it('returns the list unchanged when there is no override', () => {
    expect(applyNavOverride(NAV, undefined)).toEqual(NAV);
    expect(applyNavOverride(NAV, {})).toEqual(NAV);
  });

  it('hides the named hrefs and ignores unknown ones', () => {
    const out = applyNavOverride(NAV, { hidden: ['/donor', '/not-a-route'] });
    expect(out.map((i) => i.href)).toEqual(['/dashboard', '/dashboard/saved', '/dashboard/settings']);
  });

  // ⚠️ The rule that stops a customization screen locking someone out of the
  // product. An empty sidebar leaves no way back to the dashboard, and on mobile
  // the sidebar is the ONLY navigation.
  it('refuses an override that would hide every item', () => {
    const out = applyNavOverride(NAV, { hidden: NAV.map((i) => i.href) });
    expect(out).toEqual(NAV);
  });

  it('orders listed items first, keeping the rest in their original order', () => {
    const out = applyNavOverride(NAV, { order: ['/dashboard/settings', '/dashboard/saved'] });
    expect(out.map((i) => i.href)).toEqual([
      '/dashboard/settings', '/dashboard/saved', '/dashboard', '/donor',
    ]);
  });

  it('ignores an ordering entry for an item that is hidden or absent', () => {
    const out = applyNavOverride(NAV, { hidden: ['/donor'], order: ['/donor', '/dashboard/settings'] });
    expect(out.map((i) => i.href)).toEqual(['/dashboard/settings', '/dashboard', '/dashboard/saved']);
  });

  it('never mutates the input', () => {
    const before = NAV.map((i) => i.href);
    applyNavOverride(NAV, { order: ['/dashboard/settings'], hidden: ['/donor'] });
    expect(NAV.map((i) => i.href)).toEqual(before);
  });
});

describe('composing the layers', () => {
  it('applies the platform override for the role, then the user override', () => {
    const out = composeNavigation(
      NAV,
      'donor',
      { donor: { hidden: ['/donor'] }, organizer: { hidden: ['/dashboard'] } },
      { order: ['/dashboard/settings'] },
    );
    // organizer's override must not touch a donor
    expect(out.map((i) => i.href)).toEqual(['/dashboard/settings', '/dashboard', '/dashboard/saved']);
  });

  it('falls back to the persona default when neither layer is set', () => {
    expect(composeNavigation(NAV, 'donor', undefined, undefined)).toEqual(NAV);
    expect(composeNavigation(NAV, 'donor', {}, {})).toEqual(NAV);
  });

  // An override can only reorder or hide. Letting it ADD a link would turn a
  // presentation setting into a way to point staff at routes their role does not
  // grant — authorization is server-side, and the nav must not imply otherwise.
  it('cannot introduce a link the persona does not already have', () => {
    const out = composeNavigation(
      NAV,
      'donor',
      { donor: { order: ['/admin', '/dashboard'] } },
      { order: ['/admin'] },
    );
    expect(out.some((i) => i.href === '/admin')).toBe(false);
    expect(out).toHaveLength(NAV.length);
  });
});
