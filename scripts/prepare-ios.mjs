#!/usr/bin/env node
/**
 * Finish the Xcode project that `npx cap add ios` leaves incomplete.
 *
 *   npm run ios:prepare        # after `npx cap add ios` / `npx cap sync ios`
 *
 * ⚠️ WHY THIS EXISTS. `ios/` is a build artifact and is NOT committed (see
 * docs/native-shells.md — a `.pbxproj` conflicting on every merge costs more
 * than regenerating it). The consequence nobody had closed: **no project-level
 * configuration can survive regeneration**, so every regenerated project was
 * missing things that are not optional.
 *
 * Two of them are hard failures rather than polish:
 *
 *   1. **Missing usage descriptions crash the app.** iOS does not warn and
 *      degrade — it TERMINATES a process that touches the camera, photo library
 *      or location without the matching `NS*UsageDescription` string. The web
 *      app has `<input type="file" accept="image/*">` in campaign creation, the
 *      profile editor and admin (iOS offers "Take Photo" / "Photo Library" for
 *      those), and `/nearby` calls `navigator.geolocation`. So the generated
 *      project crashed on the core create-a-campaign flow.
 *   2. **No privacy manifest means the upload is rejected.** Apple requires
 *      `PrivacyInfo.xcprivacy`. The repo has a carefully derived one at
 *      `native/ios/PrivacyInfo.xcprivacy`, whose own header says to "copy it
 *      into the Xcode project" — a manual step that is forgotten exactly once
 *      and then fails at App Store Connect, after the build.
 *
 * This script is IDEMPOTENT: running it twice is a no-op, so it is safe to wire
 * after every `cap sync`.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IOS = join(root, 'ios');
const APP = join(IOS, 'App', 'App');
const PLIST = join(APP, 'Info.plist');
const PBXPROJ = join(IOS, 'App', 'App.xcodeproj', 'project.pbxproj');
const PRIVACY_SRC = join(root, 'native', 'ios', 'PrivacyInfo.xcprivacy');

const changes = [];
const note = (m) => { changes.push(m); console.log(`  ✔ ${m}`); };

function die(message, detail) {
  console.error(`\n❌ ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

if (!existsSync(IOS)) {
  die(
    'No ios/ directory — nothing to prepare.',
    'Generate it first:\n  npx cap add ios\n\nThen re-run this. `ios/` is intentionally not committed;\nsee docs/native-shells.md.',
  );
}
if (!existsSync(PLIST)) die(`Expected Info.plist at ${PLIST}`);
if (!existsSync(PBXPROJ)) die(`Expected an Xcode project at ${PBXPROJ}`);
if (!existsSync(PRIVACY_SRC)) die(`Missing privacy manifest at ${PRIVACY_SRC}`);

// ── 1. Info.plist ────────────────────────────────────────────────────────────
//
// The strings are shown verbatim in the system permission dialog, so they say
// what the app does with the data rather than restating the permission name.
// Apple rejects vague ones ("This app needs camera access").
const PLIST_KEYS = [
  ['NSCameraUsageDescription',
    'CharitMe uses the camera so you can photograph receipts and campaign updates without leaving the app.'],
  ['NSPhotoLibraryUsageDescription',
    'CharitMe needs your photo library so you can choose cover photos and update images for your fundraiser.'],
  ['NSPhotoLibraryAddUsageDescription',
    'CharitMe saves campaign images and donation receipts to your photo library when you ask it to.'],
  ['NSLocationWhenInUseUsageDescription',
    'CharitMe uses your location only to show fundraisers near you. It is never stored or shared.'],
  // Not a permission. Without it, App Store Connect asks the export-compliance
  // question on EVERY upload and holds the build until it is answered. The app
  // uses only HTTPS, which is exempt.
  ['ITSAppUsesNonExemptEncryption', false],
];

let plist = readFileSync(PLIST, 'utf8');
const closing = plist.lastIndexOf('</dict>\n</plist>');
if (closing === -1) die('Info.plist has an unexpected shape — refusing to edit it blindly.');

let insert = '';
for (const [key, value] of PLIST_KEYS) {
  if (plist.includes(`<key>${key}</key>`)) continue;
  const rendered = typeof value === 'boolean'
    ? `\t<${value}/>\n`
    : `\t<string>${value}</string>\n`;
  insert += `\t<key>${key}</key>\n${rendered}`;
}
if (insert) {
  plist = plist.slice(0, closing) + insert + plist.slice(closing);
  writeFileSync(PLIST, plist);
  note(`Info.plist: added ${insert.match(/<key>/g).length} required key(s)`);
}

// ── 2. Privacy manifest ──────────────────────────────────────────────────────
const privacyDest = join(APP, 'PrivacyInfo.xcprivacy');
const privacySrcText = readFileSync(PRIVACY_SRC, 'utf8');
if (!existsSync(privacyDest) || readFileSync(privacyDest, 'utf8') !== privacySrcText) {
  copyFileSync(PRIVACY_SRC, privacyDest);
  note('copied PrivacyInfo.xcprivacy into the app target');
}

// ── 3. Register it with the Xcode project ────────────────────────────────────
//
// Copying the file is not enough: a resource Xcode does not know about is not
// copied into the bundle, so the manifest would be present in the working tree
// and absent from the .ipa — which fails at upload with nothing local to see.
//
// The ids are fixed, high, and namespaced to this script so re-running cannot
// mint duplicates, and so a human reading the project can tell where they came
// from. pbxproj ids are 24 hex characters.
const FILE_REF = 'CAFE0001000000000000PRIV';
const BUILD_FILE = 'CAFE0002000000000000PRIV';

let pbx = readFileSync(PBXPROJ, 'utf8');
if (pbx.includes('PrivacyInfo.xcprivacy')) {
  console.log('  · Xcode project already references the privacy manifest');
} else {
  const before = pbx;

  pbx = pbx.replace(
    '/* End PBXBuildFile section */',
    `\t\t${BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${FILE_REF} /* PrivacyInfo.xcprivacy */; };\n/* End PBXBuildFile section */`,
  );
  pbx = pbx.replace(
    '/* End PBXFileReference section */',
    `\t\t${FILE_REF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
  );
  // Into the Resources build phase, so it lands in the bundle.
  pbx = pbx.replace(
    /(isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\n)/,
    `$1\t\t\t\t${BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */,\n`,
  );
  // And into the App group, so it is visible in the navigator.
  pbx = pbx.replace(
    /(\/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n)/,
    `$1\t\t\t\t${FILE_REF} /* PrivacyInfo.xcprivacy */,\n`,
  );

  // Every one of the four edits must have landed. A silently-skipped replace
  // would leave a project that builds locally and is rejected at upload, which
  // is the failure this script exists to prevent — so it is checked, not hoped.
  const applied = [
    [pbx.includes(`${BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile`), 'PBXBuildFile entry'],
    [pbx.includes(`${FILE_REF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference`), 'PBXFileReference entry'],
    [/isa = PBXResourcesBuildPhase;[\s\S]*?PrivacyInfo\.xcprivacy in Resources/.test(pbx), 'Resources build phase'],
    [/\/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;[\s\S]{0,400}?PrivacyInfo\.xcprivacy \*\//.test(pbx), 'App group membership'],
  ];
  const missing = applied.filter(([ok]) => !ok).map(([, what]) => what);
  if (missing.length) {
    die(
      `Could not register the privacy manifest: ${missing.join(', ')} not patched.`,
      'The generated project layout has changed. Fix this script rather than\n'
      + 'adding the file by hand in Xcode — a hand edit is lost on the next\n'
      + '`npx cap add ios`, which is the whole reason this script exists.',
    );
  }
  if (pbx === before) die('project.pbxproj was not modified — refusing to report success.');

  writeFileSync(PBXPROJ, pbx);
  note('registered PrivacyInfo.xcprivacy as a bundled resource');
}

// ── 4. App icon ──────────────────────────────────────────────────────────────
//
// ⚠️ `npx cap add ios` ships CAPACITOR'S OWN LOGO as the app icon. It is not a
// placeholder that looks like one — it is a finished 1024×1024 image, so nothing
// about the generated project looks unfinished, and it would go to review as the
// app's identity.
//
// Two hard requirements, and the second is the one that gets builds rejected
// AFTER a successful archive:
//   · exactly 1024×1024
//   · NO ALPHA CHANNEL. App Store Connect refuses the upload with "Invalid
//     Image - The app icon can't be transparent nor contain an alpha channel".
//     The web icons are all RGBA, so they cannot be used directly — which is why
//     this renders from the SVG and flattens rather than copying a PNG.
const ICON_SRC = join(root, 'apps', 'web', 'public', 'icons', 'icon-source.svg');
const ICON_DEST = join(APP, 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
// Matches `background_color` in app/manifest.ts and the shell's backgroundColor.
const ICON_BG = '#000000';

async function writeAppIcon() {
  if (!existsSync(ICON_SRC)) die(`Missing icon source at ${ICON_SRC}`);

  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    die(
      'sharp is required to render the app icon and is not installed.',
      'Run `npm install` at the repo root, then re-run this script.\n'
      + 'The icon is NOT optional: without it the build ships Capacitor\'s logo.',
    );
  }

  const png = await sharp(ICON_SRC, { density: 600 })
    .resize(1024, 1024, { fit: 'contain', background: ICON_BG })
    .flatten({ background: ICON_BG })  // ← the alpha-channel removal
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Verify what we produced rather than trusting the pipeline: a regression here
  // is invisible locally and only surfaces as a rejected upload.
  const meta = await sharp(png).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    die(`Rendered icon is ${meta.width}×${meta.height}, must be 1024×1024.`);
  }
  if (meta.hasAlpha) die('Rendered icon still has an alpha channel — App Store Connect will reject it.');

  if (existsSync(ICON_DEST) && readFileSync(ICON_DEST).equals(png)) return;
  writeFileSync(ICON_DEST, png);
  note('rendered the CharitMe app icon (1024×1024, no alpha)');
}

await writeAppIcon();

console.log(
  changes.length
    ? `\n✅ iOS project prepared (${changes.length} change${changes.length === 1 ? '' : 's'}).`
    : '\n✅ iOS project already prepared — nothing to do.',
);
console.log('\nNext, on macOS:');
console.log('  npx cap open ios');
console.log('  Signing & Capabilities → set your Team, then add Associated Domains:');
console.log('    applinks:www.charitme.com');
