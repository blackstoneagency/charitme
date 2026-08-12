import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const capConfig = read('capacitor.config.ts');
const prepare = read('scripts/prepare-ios.mjs');

// ─────────────────────────────────────────────────────────────────────────────
// The iOS shell is generated, not committed: `ios/` is a build artifact that
// `npm run ios:add` recreates (docs/native-shells.md — a `.pbxproj` conflicting
// on every merge costs more than regenerating it).
//
// The consequence is that NOTHING about the native project is under review
// except these two files. A generated project is correct only if
// `capacitor.config.ts` and `scripts/prepare-ios.mjs` are correct, so this suite
// guards them — there is no Xcode here, and CI cannot build an .ipa.
//
// Every assertion below corresponds to a failure that is silent in this repo and
// expensive somewhere else: a 2 GB bundle, a crash on a real device, or a
// rejection after a successful archive.
// ─────────────────────────────────────────────────────────────────────────────

describe('the shell does not ship the server build to every device', () => {
  it('webDir is NOT a build directory', () => {
    // ⚠️ This read `apps/web/.next`, on the reasoning that `webDir` is unused
    // while `server.url` is set. The CLI copies it regardless: measured at 2.0 GB
    // and 115 seconds, of which 2.0 GB was `.next/cache` and 56 MB was compiled
    // server code — bundled into the .ipa and never loaded.
    const webDir = /webDir:\s*'([^']+)'/.exec(capConfig)?.[1];
    expect(webDir, 'webDir must be declared').toBeDefined();
    expect(webDir, 'webDir must not point at a build output directory')
      .not.toMatch(/\.next|dist|build|out\b/);
  });

  it('webDir exists and is a self-contained page', () => {
    const webDir = /webDir:\s*'([^']+)'/.exec(capConfig)![1];
    const index = join(repo, webDir, 'index.html');
    expect(existsSync(index), `${webDir}/index.html must exist — cap copies this into the app`).toBe(true);

    const html = readFileSync(index, 'utf8');
    // It is the screen shown when the network is unreachable, so anything it
    // fetches is guaranteed to fail at exactly the moment it is needed.
    expect(html, 'the offline page must not load external resources')
      .not.toMatch(/<(script|link)[^>]+(src|href)=["']https?:\/\//);
  });

  it('points the WebView at the live origin over TLS only', () => {
    expect(capConfig).toMatch(/url:\s*'https:\/\//);
    expect(capConfig, 'cleartext HTTP would let a hostile network downgrade a page carrying a session')
      .toMatch(/cleartext:\s*false/);
  });

  it('has an error page for when the site cannot be reached', () => {
    // Without it iOS renders its own network error, which reads as "this app is
    // broken" rather than "you are offline".
    expect(capConfig).toMatch(/errorPath:\s*'index\.html'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE THAT CRASHES REAL DEVICES.
//
// iOS does not warn and degrade when an app touches a protected resource with no
// usage description — it TERMINATES the process. A WebView counts: an
// `<input type="file" accept="image/*">` offers "Take Photo" and "Photo
// Library", and `navigator.geolocation` prompts for location.
//
// So this walks the actual web source for those APIs and requires
// `prepare-ios.mjs` to declare the matching key. Adding a native capability to a
// page without the string is then a red test rather than a crash report.
// ─────────────────────────────────────────────────────────────────────────────
describe('every native capability the web app uses has a usage description', () => {
  function webSourceUses(pattern: RegExp): boolean {
    const out = execFileSync(
      'git',
      ['grep', '-lE', '--untracked', pattern.source, '--', 'app', 'components'],
      { cwd: web, encoding: 'utf8' },
    ).trim();
    return out.length > 0;
  }

  const CAPABILITIES: Array<{ name: string; key: string; detect: RegExp }> = [
    // `accept="image/…"` is what makes iOS offer the camera at all.
    { name: 'camera (image file input)', key: 'NSCameraUsageDescription', detect: /accept="image/ },
    { name: 'photo library', key: 'NSPhotoLibraryUsageDescription', detect: /accept="image/ },
    { name: 'geolocation', key: 'NSLocationWhenInUseUsageDescription', detect: /navigator\.geolocation/ },
  ];

  it('detects the capabilities it claims to — the scan is not vacuous', () => {
    // If these patterns ever stop matching, every assertion below passes for the
    // wrong reason. The web app definitely has image uploads and /nearby.
    const found = CAPABILITIES.filter((c) => webSourceUses(c.detect));
    expect(found.length, 'capability detection found nothing — the patterns have drifted')
      .toBeGreaterThanOrEqual(2);
  });

  /**
   * The usage-description keys `prepare-ios.mjs` actually writes into Info.plist.
   *
   * ⚠️ Parsed, NOT substring-matched. This was `expect(prepare).toContain(key)`,
   * and a mutation renaming `NSCameraUsageDescription` to
   * `NSCameraUsageDescriptionX` PASSED — because the typo contains the real key
   * as a substring. The one assertion standing between a code change and a crash
   * on a real device was satisfied by a key iOS has never heard of.
   */
  function declaredKeys(): string[] {
    return [...prepare.matchAll(/\['(\w+)',\s*\n?\s*(?:'|false|true)/g)].map((m) => m[1]);
  }

  it.each(CAPABILITIES)('$name → $key', ({ key, detect }) => {
    if (!webSourceUses(detect)) return; // capability removed; nothing to declare
    expect(declaredKeys(), `the app uses this capability; without ${key} iOS kills the process`)
      .toContain(key);
  });

  it('parses real keys, so a near-miss key cannot satisfy the check', () => {
    const keys = declaredKeys();
    expect(keys.length, 'key parsing found nothing — the assertions above are vacuous')
      .toBeGreaterThanOrEqual(4);
    // Every parsed key must be one iOS actually recognises in shape.
    for (const k of keys) expect(k).toMatch(/^(NS\w+UsageDescription|ITSAppUsesNonExemptEncryption)$/);
  });

  it('the descriptions say what the data is FOR, not what the permission is', () => {
    // Apple rejects "This app needs camera access". Each string is shown verbatim
    // in the system dialog.
    const strings = [...prepare.matchAll(/\['(NS\w+UsageDescription)',\s*\n?\s*'([^']+)'/g)];
    expect(strings.length, 'no usage descriptions found — the parse has drifted').toBeGreaterThanOrEqual(3);
    for (const [, key, text] of strings) {
      expect(text.length, `${key} is too terse to pass review`).toBeGreaterThan(40);
      expect(text, `${key} should name the product, not just the permission`).toMatch(/CharitMe/);
    }
  });
});

describe('what App Store Connect rejects after a successful archive', () => {
  it('installs the privacy manifest, which Apple requires', () => {
    expect(prepare).toContain('PrivacyInfo.xcprivacy');
    expect(existsSync(join(repo, 'native/ios/PrivacyInfo.xcprivacy'))).toBe(true);
  });

  it('registers it as a bundled RESOURCE, not merely copies the file', () => {
    // A resource Xcode does not know about is not copied into the .ipa, so the
    // manifest would be present locally and absent from the upload — visible
    // only as a rejection.
    expect(prepare).toMatch(/PBXResourcesBuildPhase/);
    expect(prepare).toMatch(/PBXBuildFile/);
    expect(prepare).toMatch(/PBXFileReference/);
  });

  it('verifies its own pbxproj edits instead of assuming they landed', () => {
    // A silently-skipped string replace is the failure mode here: it leaves a
    // project that builds locally and is rejected at upload.
    expect(prepare).toMatch(/const missing = applied\.filter/);
    expect(prepare).toMatch(/refusing to report success/);
  });

  it('renders a 1024×1024 app icon with NO alpha channel', () => {
    // Two separate rejections: Capacitor's template ships its own logo as a
    // finished icon, and every web icon is RGBA — App Store Connect refuses
    // "The app icon can't be transparent nor contain an alpha channel".
    expect(prepare).toMatch(/\.flatten\(/);
    expect(prepare).toMatch(/hasAlpha/);
    expect(prepare).toMatch(/1024/);
    expect(existsSync(join(repo, 'apps/web/public/icons/icon-source.svg'))).toBe(true);
  });

  it('declares export compliance so uploads are not held on a question', () => {
    expect(prepare).toContain('ITSAppUsesNonExemptEncryption');
  });
});

describe('what is missing from the generated project but invisible in Xcode', () => {
  it('writes a SHARED scheme, not just whatever Xcode auto-creates', () => {
    // ⚠️ `cap add ios` generates no scheme. Opening the project makes Xcode
    // auto-create a USER scheme under xcuserdata/, so it builds fine on the
    // machine that opened it and the gap is invisible. Nothing scripted works:
    // `xcodebuild -scheme App` — how an archive, an export or any CI build
    // selects what to build — fails on a project nobody has opened.
    expect(prepare).toMatch(/xcshareddata/);
    expect(prepare).toMatch(/xcschemes/);
    expect(prepare).toMatch(/ArchiveAction/);
  });

  it('reads the target id from the project instead of hardcoding it', () => {
    // Capacitor owns project.pbxproj. A stale hardcoded blueprint id would
    // produce a scheme Xcode lists and cannot build — worse than having none.
    expect(prepare).toMatch(/isa = PBXNativeTarget/);
    expect(prepare).toMatch(/refusing to write a scheme with a guessed id/);
  });

  it('renders a launch screen that matches the app background', () => {
    // ⚠️ Capacitor's template splash is WHITE and carries Capacitor's logo,
    // while capacitor.config.ts sets backgroundColor '#000000' with the comment
    // that "a white shell behind a black page flashes on every launch". The
    // splash WAS the white shell — launch went white → black on every cold start.
    expect(prepare).toMatch(/Splash\.imageset/);
    expect(prepare).toMatch(/meanLuma/);
  });

  it('reads the splash filenames from Contents.json rather than guessing', () => {
    // The imageset lists three scale variants by name. Hardcoding them means a
    // template change writes files the catalog does not reference, leaving the
    // vendor splash in place while reporting success.
    expect(prepare).toMatch(/Contents\.json/);
    expect(prepare).toMatch(/refusing to guess filenames/);
  });
});

describe('the shell and the web manifest agree', () => {
  const manifest = read('apps/web/app/manifest.ts');

  it('uses the same background colour, so launch does not flash', () => {
    const bg = /background_color:\s*'(#[0-9a-fA-F]{3,8})'/.exec(manifest)?.[1];
    expect(bg).toBeDefined();
    expect(capConfig, 'a white shell behind a black page flashes on every launch')
      .toContain(`backgroundColor: '${bg}'`);
  });

  it('claims the same origin the association file is served from', () => {
    // iOS does not follow redirects for apple-app-site-association, so the host
    // the shell loads and the host that serves the file must be identical.
    const url = /url:\s*'(https:\/\/[^']+)'/.exec(capConfig)?.[1];
    expect(url).toBe('https://www.charitme.com');
  });
});

describe('the generated project stays out of version control', () => {
  it('ios/ is ignored, so a 1,000-file build artifact cannot be committed', () => {
    expect(read('.gitignore')).toMatch(/^\/ios$/m);
  });

  it('regenerating always re-runs the prepare step', () => {
    // The whole design depends on this: `cap add`/`cap sync` overwrite the
    // project, so a prepare step that has to be remembered separately is one
    // that eventually is not.
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['ios:add']).toMatch(/ios:prepare/);
    expect(pkg.scripts['ios:sync']).toMatch(/ios:prepare/);
  });
});
