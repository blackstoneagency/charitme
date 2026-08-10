import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// A store privacy declaration is a claim about what the code does, made once and
// then never looked at again while the code keeps changing. Apple treats a
// mismatch between the declaration and observed behaviour as grounds for
// removal, so the drift is not cosmetic.
//
// `assembleUserExport` is the authoritative list of what we hold about a user —
// it is what the GDPR export actually returns. This ties the declaration to it:
// add a table to the export and this fails until the declaration mentions it.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const DOC = path.join(REPO_ROOT, 'docs', 'store-privacy-declarations.md');
const PLIST = path.join(REPO_ROOT, 'native', 'ios', 'PrivacyInfo.xcprivacy');

const declarations = readFileSync(DOC, 'utf8');
const plist = readFileSync(PLIST, 'utf8');
const privacyLib = readFileSync(path.join(__dirname, '..', 'lib', 'privacy.ts'), 'utf8');

/** Tables the GDPR export reads — i.e. everything we admit to holding. */
function exportedTables(): string[] {
  const tables = new Set<string>();
  for (const m of privacyLib.matchAll(/rowsFor\('([a-z_]+)'/g)) tables.add(m[1]);
  for (const m of privacyLib.matchAll(/\.from\('([a-z_]+)'\)/g)) tables.add(m[1]);
  return [...tables];
}

describe('the declaration matches what the export actually holds', () => {
  it('reads a real export list', () => {
    // A regex that matched nothing would make the next assertion vacuous.
    expect(exportedTables().length).toBeGreaterThan(5);
    expect(exportedTables()).toContain('donations');
  });

  it('names every table the export returns', () => {
    const missing = exportedTables().filter((t) => !declarations.includes(t));
    expect(
      missing,
      'these tables are in the GDPR export but not in the store privacy declaration — a store form would be answered wrong',
    ).toEqual([]);
  });
});

describe('the iOS privacy manifest', () => {
  it('declares no tracking, which is only true while no third-party SDK exists', () => {
    expect(plist).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  });

  it('declares the required-reason API Capacitor actually uses', () => {
    // Omitting this starts as a build warning and becomes a rejection.
    expect(plist).toContain('NSPrivacyAccessedAPICategoryUserDefaults');
    expect(plist).toContain('CA92.1');
  });

  it('declares payment info, since donations are held', () => {
    expect(plist).toContain('NSPrivacyCollectedDataTypePaymentInfo');
  });

  it('is well-formed enough to parse as a plist', () => {
    expect(plist.trimStart()).toMatch(/^<\?xml/);
    // Every <dict> closes. A malformed manifest fails at archive time, long
    // after anyone remembers editing it.
    expect((plist.match(/<dict>/g) ?? []).length).toBe((plist.match(/<\/dict>/g) ?? []).length);
    expect((plist.match(/<array>/g) ?? []).length).toBe((plist.match(/<\/array>/g) ?? []).length);
  });
});

describe('claims in the declaration that a grep can check', () => {
  it('is telling the truth that no third-party analytics SDK is present', () => {
    // The single most consequential claim in the document: "is data used to
    // track you? No". If an SDK ever lands, this must fail before a reviewer
    // finds the mismatch.
    const appDir = path.join(__dirname, '..');
    const pkg = readFileSync(path.join(appDir, 'package.json'), 'utf8');
    for (const sdk of [
      'react-ga',
      'firebase',
      'posthog-js',
      '@segment/analytics',
      'mixpanel-browser',
      'amplitude-js',
      'react-facebook-pixel',
    ]) {
      expect(pkg, `${sdk} is installed — the "no tracking" declaration is now false`).not.toContain(`"${sdk}"`);
    }
  });

  it('names the processors that receive user data', () => {
    // Play counts a sub-processor as sharing even when it is not an ad network.
    for (const processor of ['Stripe', 'Supabase', 'Resend', 'OpenAI']) {
      expect(declarations).toContain(processor);
    }
  });
});
