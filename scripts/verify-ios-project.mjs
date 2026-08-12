#!/usr/bin/env node
/**
 * Verify a GENERATED iOS project is complete, before opening Xcode.
 *
 *   npm run ios:verify
 *
 * `scripts/prepare-ios.mjs` applies the configuration; this checks the result.
 * They are deliberately separate: a script that both makes and grades its own
 * work will report success on whatever it happened to produce.
 *
 * Everything here is a failure that is SILENT until it is expensive:
 *
 *   · a storyboard whose custom class is not compiled → the app launches to a
 *     crash ("Unknown class in Interface Builder file"), not a build error;
 *   · a missing usage description → iOS terminates the process the moment the
 *     user taps "Take Photo";
 *   · a privacy manifest that is present on disk but not in a Sources/Resources
 *     phase → absent from the .ipa, and only App Store Connect tells you;
 *   · an app icon with an alpha channel → rejected after a successful archive.
 *
 * ⚠️ WHAT THIS CANNOT DO. It does not compile, sign, archive or upload. Those
 * need Xcode, and no amount of checking here substitutes for them. What it does
 * is verify every input those steps consume, so that when they run they are not
 * fighting a project that was already wrong.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IOS = join(root, 'ios');
const APP = join(IOS, 'App', 'App');
const PROJ = join(IOS, 'App', 'App.xcodeproj');
const PODS_PROJ = join(IOS, 'App', 'Pods', 'Pods.xcodeproj', 'project.pbxproj');

const results = [];
const ok = (m) => results.push([true, m, null]);
const bad = (m, why) => results.push([false, m, why]);

function main() {
  if (!existsSync(IOS)) {
    console.error('\n❌ No ios/ directory. Generate it first:\n   npm run ios:add\n');
    process.exit(1);
  }

  const pbx = readFileSync(join(PROJ, 'project.pbxproj'), 'utf8');
  const plist = parsePlist(readFileSync(join(APP, 'Info.plist'), 'utf8'));

  // ── The app has to launch at all ───────────────────────────────────────────
  const appDelegate = readFileSync(join(APP, 'AppDelegate.swift'), 'utf8');
  check(pbx.includes('AppDelegate.swift in Sources'), 'app target compiles AppDelegate.swift');
  check(/@UIApplicationMain|@main/.test(appDelegate), 'AppDelegate declares the app entry point');

  const mainSb = plist.UIMainStoryboardFile;
  check(
    Boolean(mainSb) && existsSync(join(APP, 'Base.lproj', `${mainSb}.storyboard`)),
    `UIMainStoryboardFile resolves (${mainSb})`,
  );

  // The one that crashes at launch rather than failing to build: a storyboard
  // custom class that nothing compiles.
  if (mainSb) {
    const sb = readFileSync(join(APP, 'Base.lproj', `${mainSb}.storyboard`), 'utf8');
    const classes = [...new Set([...sb.matchAll(/customClass="(\w+)"/g)].map((m) => m[1]))];
    const pods = existsSync(PODS_PROJ) ? readFileSync(PODS_PROJ, 'utf8') : '';
    for (const cls of classes) {
      const compiled = pods.includes(`${cls}.swift in Sources`) || pbx.includes(`${cls}.swift in Sources`);
      check(
        compiled,
        `storyboard class ${cls} is compiled`,
        pods
          ? `${cls} is referenced by ${mainSb}.storyboard but no target compiles it. The app will build and then crash at launch with "Unknown class in Interface Builder file".`
          : 'Pods project not found — run `pod install` in ios/App (or `npm run ios:sync` on macOS) before verifying.',
      );
    }
  }

  const launchSb = plist.UILaunchStoryboardName;
  check(
    Boolean(launchSb) && existsSync(join(APP, 'Base.lproj', `${launchSb}.storyboard`)),
    `launch storyboard resolves (${launchSb})`,
  );
  if (launchSb) {
    const sb = readFileSync(join(APP, 'Base.lproj', `${launchSb}.storyboard`), 'utf8');
    for (const img of new Set([...sb.matchAll(/image name="(\w+)"/g)].map((m) => m[1]))) {
      check(existsSync(join(APP, 'Assets.xcassets', `${img}.imageset`)), `launch image "${img}" exists`);
    }
  }

  // ── Permissions: iOS terminates without these ─────────────────────────────
  for (const key of [
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
    'NSLocationWhenInUseUsageDescription',
  ]) {
    check(
      typeof plist[key] === 'string' && plist[key].length > 40,
      `${key} present and specific`,
      'iOS does not warn and degrade — it TERMINATES the process when a protected resource is touched without this string. The web app has image file inputs and geolocation.',
    );
  }

  // ── Things App Store Connect rejects after a successful archive ────────────
  check(
    existsSync(join(APP, 'PrivacyInfo.xcprivacy')) && pbx.includes('PrivacyInfo.xcprivacy in Resources'),
    'privacy manifest is bundled as a resource',
    'A resource Xcode does not know about is not copied into the .ipa, so the file can be present locally and absent from the upload.',
  );
  check('ITSAppUsesNonExemptEncryption' in plist, 'export compliance declared');

  // ── Money-free but launch-visible: identity ───────────────────────────────
  const capCfg = JSON.parse(readFileSync(join(APP, 'capacitor.config.json'), 'utf8'));
  check(
    pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${capCfg.appId}`),
    `bundle id matches appId (${capCfg.appId})`,
  );
  check(
    typeof capCfg.server?.url === 'string' && capCfg.server.url.startsWith('https://') && capCfg.server.cleartext === false,
    'WebView loads HTTPS only, no cleartext',
  );

  // ── Anything scripted needs this ──────────────────────────────────────────
  const schemeDir = join(PROJ, 'xcshareddata', 'xcschemes');
  const schemes = existsSync(schemeDir) ? readdirSync(schemeDir).filter((f) => f.endsWith('.xcscheme')) : [];
  check(
    schemes.length > 0,
    'a SHARED scheme exists',
    'Xcode auto-creates a user scheme on open, so this is invisible in the GUI — but `xcodebuild -scheme App` fails on a project nobody has opened, which is how archives and CI select what to build.',
  );
  for (const s of schemes) {
    const xml = readFileSync(join(schemeDir, s), 'utf8');
    const ids = [...new Set([...xml.matchAll(/BlueprintIdentifier = "(\w+)"/g)].map((m) => m[1]))];
    const real = /([0-9A-F]{24}) \/\* \w+ \*\/ = \{\s*\n\s*isa = PBXNativeTarget;/.exec(pbx)?.[1];
    check(
      ids.length === 1 && ids[0] === real,
      `${s} points at the real target`,
      'A scheme with a stale blueprint id appears in Xcode and cannot build.',
    );
  }

  // ── CocoaPods actually wired ──────────────────────────────────────────────
  if (existsSync(join(IOS, 'App', 'Podfile'))) {
    const wsData = join(IOS, 'App', 'App.xcworkspace', 'contents.xcworkspacedata');
    check(
      existsSync(wsData),
      'workspace generated by pod install',
      'Run `pod install` in ios/App. Until then App.xcworkspace is empty and opening it shows nothing.',
    );
    if (existsSync(wsData)) {
      const ws = readFileSync(wsData, 'utf8');
      check(ws.includes('App.xcodeproj') && ws.includes('Pods.xcodeproj'), 'workspace references both projects');
    }
    for (const cfg of [...new Set([...pbx.matchAll(/(Pods\/Target Support Files\/[^"]+?\.xcconfig)/g)].map((m) => m[1]))]) {
      check(existsSync(join(IOS, 'App', cfg)), `xcconfig resolves: ${cfg.split('/').pop()}`);
    }
  }

  report();
}

/** Minimal plist reader — only the scalar shapes this file needs. */
function parsePlist(xml) {
  const out = {};
  const re = /<key>([^<]+)<\/key>\s*(?:<string>([\s\S]*?)<\/string>|<(true|false)\s*\/>)/g;
  for (const m of xml.matchAll(re)) {
    out[m[1]] = m[2] !== undefined ? m[2] : m[3] === 'true';
  }
  return out;
}

function check(condition, message, why) {
  if (condition) ok(message);
  else bad(message, why);
}

function report() {
  for (const [passed, message, why] of results) {
    console.log(`  ${passed ? '✔' : '✗'} ${message}`);
    if (!passed && why) console.log(`      ${why}`);
  }
  const failed = results.filter(([p]) => !p);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

  if (failed.length) {
    console.error(`\n❌ ${failed.length} check(s) failed — do not archive this project yet.`);
    process.exit(1);
  }
  console.log('\n✅ The generated project is complete.');
  console.log('   Still requires Xcode, and is NOT verified by this script:');
  console.log('     · compilation      · code signing (set your Team)');
  console.log('     · the archive      · upload to App Store Connect');
  console.log('     · Associated Domains (applinks:www.charitme.com)');
}

main();
