import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// The two store builds were recorded as blocked on toolchains — a JDK plus the
// Android SDK, and macOS plus Xcode. GitHub runners have both, so the toolchain
// half is solvable in this repo; what remains is genuinely owner-side secrets.
//
// These workflows only ever run on demand, which means nothing exercises them
// day to day and a broken one is discovered at the worst moment. This checks the
// parts that fail SILENTLY rather than loudly.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = path.join(__dirname, '..', '..', '..');
const android = readFileSync(path.join(ROOT, '.github', 'workflows', 'android-twa.yml'), 'utf8');
const ios = readFileSync(path.join(ROOT, '.github', 'workflows', 'ios-archive.yml'), 'utf8');

describe('both builds are manual only', () => {
  it('never trigger on push', () => {
    // Each build consumes a version code / build number, and an accidental
    // upload is not undoable from either console.
    for (const [name, wf] of [['android', android], ['ios', ios]] as const) {
      expect(wf, `${name} must be workflow_dispatch only`).toContain('workflow_dispatch');
      expect(wf.split('jobs:')[0], `${name} must not run on push`).not.toMatch(/^\s*push:/m);
    }
  });

  it('fail loudly when their signing secrets are absent', () => {
    // ⚠️ The failure mode this prevents: Bubblewrap generates a NEW keystore
    // when it cannot find one, and xcodebuild falls back to automatic signing.
    // Both produce something, and both are rejected at upload — long after the
    // build reported success.
    expect(android).toContain('ANDROID_KEYSTORE_BASE64 is not set');
    expect(ios).toContain('Missing secrets:');
  });
});

describe('the iOS archive installs what the repo cannot otherwise ship', () => {
  it('copies the privacy manifest into the generated project', () => {
    // ⚠️ `ios/` is generated and not committed, so a PrivacyInfo.xcprivacy that
    // lives only in the repo is absent from every build. Apple requires it in
    // the bundle. Nothing else would catch this: the file exists, the workflow
    // succeeds, and the declaration simply is not there.
    expect(existsSync(path.join(ROOT, 'native', 'ios', 'PrivacyInfo.xcprivacy'))).toBe(true);
    expect(ios).toContain('native/ios/PrivacyInfo.xcprivacy');
    expect(ios).toMatch(/cp native\/ios\/PrivacyInfo\.xcprivacy ios\/App\/App\//);
  });

  it('does not add native tooling to the web app package', () => {
    // @capacitor/* are build tooling for a shell, not runtime dependencies of
    // the website; in apps/web they would join every Vercel install.
    expect(ios).toContain('--no-save');
    const pkg = readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
    expect(pkg).not.toContain('"@capacitor/ios"');
  });

  it('sets an explicit build number', () => {
    // App Store Connect rejects a build whose number is not higher than the last
    // upload for that version, and says so only after the upload completes.
    expect(ios).toContain('CFBundleVersion');
    expect(ios).toContain('CFBundleShortVersionString');
  });
});

describe('the Android build stays in step with the web manifest', () => {
  it('builds from the committed twa-manifest rather than a prompt', () => {
    // `bubblewrap init` prompts interactively and takes whatever is typed that
    // day; twa-manifest.json is committed and sync-tested against
    // app/manifest.ts, which is what makes the build reproducible.
    expect(android).toContain('twa-manifest.json');
    expect(existsSync(path.join(ROOT, 'twa-manifest.json'))).toBe(true);
  });

  it('reports the signing fingerprint the assetlinks file needs', () => {
    // Getting this wrong is the most common reason a TWA ships with an address
    // bar — which is what gets a build read as a repackaged website.
    expect(android).toContain('keytool -list');
    expect(android).toMatch(/App integrity/);
  });
});
