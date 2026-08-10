import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// `assetlinks.json` and `apple-app-site-association` each assert a cryptographic
// identity this repository cannot derive: the SHA-256 of the certificate Play
// signs with, and `TEAMID.bundle.id` from the Apple Developer account.
//
// Serving either with a placeholder is worse than serving nothing. Android
// reports "verification did not succeed" and iOS just declines to associate —
// both read as a store-console problem and send you to look in the wrong place.
// An absent file names its own cause.
//
// So the contract under test is: absent unless configured, correct when it is,
// and never claiming a path the app must not intercept.
// ─────────────────────────────────────────────────────────────────────────────

const REAL_FINGERPRINT = 'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90';

async function load() {
  vi.resetModules();
  return import('../lib/app-store-links');
}

const ENV_KEYS = ['ANDROID_PACKAGE_NAME', 'ANDROID_SHA256_FINGERPRINT', 'IOS_APP_ID'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('Android asset links', () => {
  it('is absent until BOTH the package and the fingerprint are configured', async () => {
    let mod = await load();
    expect(mod.androidAssetLinks()).toBeNull();

    process.env.ANDROID_PACKAGE_NAME = 'com.charitme.app';
    mod = await load();
    expect(mod.androidAssetLinks(), 'a package with no fingerprint cannot verify').toBeNull();
  });

  it('refuses a malformed fingerprint rather than serving it', async () => {
    // The common mistake is pasting the hex without separators, or a truncated
    // copy. Both produce a file that looks configured and never verifies.
    process.env.ANDROID_PACKAGE_NAME = 'com.charitme.app';
    process.env.ANDROID_SHA256_FINGERPRINT = 'A1B2C3D4';
    const mod = await load();
    expect(mod.androidAssetLinks()).toBeNull();
  });

  it('states both relations when configured', async () => {
    process.env.ANDROID_PACKAGE_NAME = 'com.charitme.app';
    process.env.ANDROID_SHA256_FINGERPRINT = REAL_FINGERPRINT;
    const mod = await load();
    const [statement] = mod.androidAssetLinks()!;

    expect(statement.target.package_name).toBe('com.charitme.app');
    expect(statement.target.sha256_cert_fingerprints).toEqual([REAL_FINGERPRINT]);
    // `handle_all_urls` alone gives app links but leaves the TWA's address bar
    // in place — which is what makes a reviewer read the build as a repackaged
    // website.
    expect(statement.relation).toContain('delegate_permission/common.handle_all_urls');
  });
});

describe('Apple app site association', () => {
  it('is absent until the app id is configured', async () => {
    const mod = await load();
    expect(mod.appleAppSiteAssociation()).toBeNull();
  });

  it('refuses an app id that is not TEAMID.bundle.id', async () => {
    process.env.IOS_APP_ID = 'com.charitme.app';
    const mod = await load();
    expect(mod.appleAppSiteAssociation(), 'a bundle id with no team prefix cannot associate').toBeNull();
  });

  it('never claims the payment return paths', async () => {
    process.env.IOS_APP_ID = 'AB12CD34EF.com.charitme.app';
    const mod = await load();
    const { paths } = mod.appleAppSiteAssociation()!.applinks.details[0];

    // ⚠️ The real hazard behind this test: a universal link that swallows a
    // Stripe return strands the donor in an app screen that cannot finish the
    // checkout the browser was mid-way through — after the money has moved.
    for (const excluded of ['NOT /api/*', 'NOT /thank-you/*', 'NOT /auth/*']) {
      expect(paths).toContain(excluded);
    }
    // iOS takes the LAST matching entry, so an exclusion listed after a wildcard
    // would be the one that loses.
    expect(paths.indexOf('NOT /thank-you/*')).toBeLessThan(paths.indexOf('/'));
    expect(paths, 'a bare wildcard hands the app every URL on the domain').not.toContain('*');
  });

  it('claims the links people actually share', async () => {
    process.env.IOS_APP_ID = 'AB12CD34EF.com.charitme.app';
    const mod = await load();
    const { paths } = mod.appleAppSiteAssociation()!.applinks.details[0];
    expect(paths).toContain('/campaigns/*');
    expect(paths).toContain('/donate/*');
  });

  it('sends an empty apps array, which Apple requires', async () => {
    process.env.IOS_APP_ID = 'AB12CD34EF.com.charitme.app';
    const mod = await load();
    expect(mod.appleAppSiteAssociation()!.applinks.apps).toEqual([]);
  });
});
