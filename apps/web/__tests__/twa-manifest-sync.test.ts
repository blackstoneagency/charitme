import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import manifest from '../app/manifest';

// ─────────────────────────────────────────────────────────────────────────────
// `twa-manifest.json` is what Bubblewrap turns into the Play Store build. It is
// a COPY of values that also live in `app/manifest.ts`, and a copy is a thing
// that drifts.
//
// Drift here is unusually expensive: the Android build is generated once, months
// pass, and the installed app keeps the old start URL, the old splash colour and
// shortcuts pointing at routes that have since moved. None of it shows up on the
// website, and no browser test can see it — the only symptom is on a phone
// someone already installed.
//
// This is also why `twa-manifest.json` is committed rather than left to
// `bubblewrap init`, which prompts interactively and takes whatever the operator
// types that day.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const twa = JSON.parse(readFileSync(path.join(REPO_ROOT, 'twa-manifest.json'), 'utf8'));
const web = manifest();

describe('twa-manifest.json tracks the web manifest', () => {
  it('opens the same URL', () => {
    expect(twa.startUrl).toBe(web.start_url);
  });

  it('splashes the same colour', () => {
    // The one that flashed white before a black app. Two files now, so it can go
    // wrong twice.
    expect(twa.backgroundColor.toLowerCase()).toBe(web.background_color?.toLowerCase());
  });

  it('tints the system bars the same colour', () => {
    expect(twa.themeColor.toLowerCase()).toBe(web.theme_color?.toLowerCase());
  });

  it('uses the same display mode and orientation', () => {
    expect(twa.display).toBe(web.display);
    expect(twa.orientation).toBe(web.orientation);
  });

  it('carries the same shortcuts, pointing at the same routes', () => {
    const webShortcuts = (web.shortcuts ?? []).map((s) => ({ name: s.name, url: s.url }));
    const twaShortcuts = (twa.shortcuts ?? []).map((s: { name: string; url: string }) => ({
      name: s.name,
      url: s.url,
    }));
    expect(twaShortcuts).toEqual(webShortcuts);
  });

  it('references icons that exist in this repo', () => {
    // A 404 icon URL does not fail the build — it produces an app with a blank
    // launcher icon, discovered after upload.
    for (const url of [twa.iconUrl, twa.maskableIconUrl]) {
      const file = new URL(url).pathname;
      expect(existsSync(path.join(__dirname, '..', 'public', file)), `${url} is not in public/`).toBe(true);
    }
  });

  it('claims the scope the web manifest declares', () => {
    expect(new URL(twa.fullScopeUrl).pathname).toBe(web.scope);
  });
});

describe('the Android package id is stated once', () => {
  it('matches what the native-shell docs tell an operator to configure', () => {
    // `ANDROID_PACKAGE_NAME` must equal this or Digital Asset Links verifies
    // against a package that is not the one on the device — and the symptom is
    // an address bar, not an error.
    const docs = readFileSync(path.join(REPO_ROOT, 'docs', 'native-shells.md'), 'utf8');
    expect(twa.packageId).toBe('com.charitme.app');
    const capacitor = readFileSync(path.join(REPO_ROOT, 'capacitor.config.ts'), 'utf8');
    expect(capacitor, 'the two shells must not claim different ids').toContain(`appId: '${twa.packageId}'`);
    expect(docs).toContain('ANDROID_SHA256_FINGERPRINT');
  });
});
