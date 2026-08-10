import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import manifest from '../app/manifest';

// ─────────────────────────────────────────────────────────────────────────────
// The manifest is the app's identity in three places at once: Chrome's install
// flow, a Play Store TWA (Bubblewrap generates the Android project FROM this
// file), and iOS "Add to Home Screen". A mistake here does not show up on the
// website at all — it shows up on someone's home screen, where nothing on the
// site can explain it.
//
// Two failures this pins down, both of which were live:
//
//  1. `background_color` was near-white while the app opens BLACK. That colour
//     is the splash, painted before a byte renders, so every launch of the
//     installed app flashed white and then went dark. It is invisible in a
//     browser — only an installed app has a splash.
//
//  2. A shortcut URL is a control on the home screen. If it 404s there is no
//     surface in the app to explain it, and no audit reaches it: the internal
//     link sweep crawls rendered pages, and these links are not on any page.
// ─────────────────────────────────────────────────────────────────────────────

const WEB_ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(WEB_ROOT, 'app');
const m = manifest();

/** Does a route resolve to a real page file? Route groups make this non-obvious. */
function routeExists(url: string): boolean {
  const segments = url.replace(/^\//, '').split('/').filter(Boolean);
  // `/campaigns` is served by `app/campaigns/(list)/page.tsx` — a route group,
  // which is a directory in the tree but NOT a segment in the URL. So a plain
  // join misses it, and a test that only did the plain join would report every
  // grouped route as missing.
  const candidates = [
    path.join(APP_DIR, ...segments, 'page.tsx'),
    ...['(list)', '(detail)', '(index)'].map((g) => path.join(APP_DIR, ...segments, g, 'page.tsx')),
  ];
  return candidates.some(existsSync);
}

describe('web app manifest', () => {
  it('names every field a store build reads', () => {
    expect(m.id, 'without id, identity is derived from start_url').toBeTruthy();
    expect(m.scope, 'Bubblewrap reads scope to decide which links the app claims').toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.display).toBe('standalone');
  });

  it('ships a maskable icon, or Android crops the square one into its circle', () => {
    const purposes = (m.icons ?? []).map((i) => i.purpose);
    expect(purposes).toContain('maskable');
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    // Play's own listing requires 512; 192 is the minimum installable icon.
    expect(sizes).toContain('512x512');
    expect(sizes).toContain('192x192');
  });

  it('splashes the colour the app actually opens as', () => {
    // Read the dark `--bg` out of the stylesheet rather than restating it here.
    // A literal would drift the moment the theme changes, and drift is exactly
    // the failure — the white splash survived because nothing tied the two
    // values together.
    const css = readFileSync(path.join(APP_DIR, 'globals.css'), 'utf8');
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"] {'));
    const darkBg = darkBlock.match(/--bg:\s*(#[0-9a-fA-F]{3,8})/)?.[1];

    expect(darkBg, 'could not find the dark --bg; this test is reading the wrong thing').toBeTruthy();
    // The layout's inline theme script defaults to dark, so dark IS the opening
    // state for anyone who has not chosen otherwise.
    const layout = readFileSync(path.join(APP_DIR, 'layout.tsx'), 'utf8');
    expect(layout).toContain("setAttribute('data-theme','dark')");

    expect(m.background_color?.toLowerCase()).toBe(darkBg?.toLowerCase());
  });

  it('points every shortcut at a route that exists', () => {
    const broken = (m.shortcuts ?? []).filter((s) => !routeExists(s.url));
    expect(broken.map((s) => s.url)).toEqual([]);
  });

  it('has shortcuts at all, and no more than the platform shows', () => {
    // Android surfaces 3–4 on long-press; anything beyond is written and never
    // seen. Declaring zero is also a real state, so this asserts the intent.
    expect((m.shortcuts ?? []).length).toBeGreaterThan(0);
    expect((m.shortcuts ?? []).length).toBeLessThanOrEqual(4);
  });

  it('knows a real route from a fabricated one', () => {
    // Guards the guard. `routeExists` returning true unconditionally would make
    // the shortcut assertion vacuous.
    expect(routeExists('/campaigns')).toBe(true);
    expect(routeExists('/definitely-not-a-route-xyz')).toBe(false);
  });
});
