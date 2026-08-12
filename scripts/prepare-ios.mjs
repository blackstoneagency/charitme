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
 *
 * ⚠️ CAPACITOR IS PINNED TO v7 ON PURPOSE. v8 declares
 * `engines: { node: ">=22.0.0" }` while `.node-version` pins 20.19.0 and
 * `.npmrc` sets `engine-strict=true` — so `npm ci` FAILS rather than warns, in
 * CI and on Vercel alike. v7 requires only `>=20.0.0`. Do not bump the major
 * without moving the Node pin first, which changes the production runtime.
 * `apps/web/__tests__/pinned-node-engines.test.ts` fails if this regresses.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
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

// ── 5. Launch screen ─────────────────────────────────────────────────────────
//
// ⚠️ Capacitor's template splash is WHITE and carries CAPACITOR'S LOGO. Two
// problems, and the second is the one the config file already warned about:
//
//   · It is someone else's branding on the first screen of the app.
//   · `capacitor.config.ts` sets `backgroundColor: '#000000'` with the comment
//     "a white shell behind a black page flashes on every launch". The splash
//     itself was the white shell. Launch went white → black on every cold start,
//     which is exactly the flash that setting exists to prevent.
//
// Rendered black with the CharitMe mark centred, so the launch screen and the
// first painted page are the same colour and the transition is invisible.
const SPLASH_DIR = join(APP, 'Assets.xcassets', 'Splash.imageset');
const SPLASH_PX = 2732;
// The mark sits at ~22% of the canvas. The imageset is scaled to fill screens of
// very different sizes, so a large mark crops badly on the narrowest devices.
const MARK_PX = 600;

async function writeSplash() {
  const { default: sharp } = await import('sharp');

  const mark = await sharp(ICON_SRC, { density: 600 })
    .resize(MARK_PX, MARK_PX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const png = await sharp({
    create: {
      width: SPLASH_PX, height: SPLASH_PX, channels: 3,
      background: ICON_BG,
    },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Verify it is actually dark before shipping it — a regression that silently
  // restored a white splash would reintroduce the launch flash, and nothing else
  // here would notice.
  const { channels } = await sharp(png).stats();
  const meanLuma = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
  if (meanLuma > 60) die(`Rendered splash is too light (mean ${meanLuma.toFixed(0)}/255) — it would flash white on launch.`);

  const manifest = JSON.parse(readFileSync(join(SPLASH_DIR, 'Contents.json'), 'utf8'));
  const names = manifest.images.map((i) => i.filename).filter(Boolean);
  if (names.length === 0) die('Splash.imageset lists no images — refusing to guess filenames.');

  let wrote = 0;
  for (const name of names) {
    const dest = join(SPLASH_DIR, name);
    if (existsSync(dest) && readFileSync(dest).equals(png)) continue;
    writeFileSync(dest, png);
    wrote += 1;
  }
  if (wrote) note(`rendered the CharitMe launch screen on ${ICON_BG} (${wrote} image${wrote === 1 ? '' : 's'})`);
}

await writeSplash();

// ── 6. A SHARED scheme ───────────────────────────────────────────────────────
//
// ⚠️ `cap add ios` generates no scheme at all, and the gap is invisible in the
// GUI: opening the project makes Xcode auto-create a *user* scheme under
// `xcuserdata/`, so it builds and runs on the machine that opened it. Nothing
// looks wrong.
//
// It is not there for anything scripted. `xcodebuild -scheme App` — which is how
// an archive, an export, or any CI build selects what to build — fails with "The
// project named 'App' does not contain a scheme named 'App'" on a project nobody
// has opened yet. A user scheme also lives in a directory Xcode treats as
// per-developer state, so it is exactly the thing that does not travel.
//
// The target id is READ from the project rather than hardcoded: Capacitor owns
// that file and a stale id would produce a scheme that Xcode lists and cannot
// build, which is a worse failure than having none.
function writeSharedScheme() {
  const schemeDir = join(IOS, 'App', 'App.xcodeproj', 'xcshareddata', 'xcschemes');
  const schemePath = join(schemeDir, 'App.xcscheme');

  const target = /([0-9A-F]{24}) \/\* (\w+) \*\/ = \{\s*\n\s*isa = PBXNativeTarget;/.exec(pbx ?? readFileSync(PBXPROJ, 'utf8'));
  if (!target) {
    die(
      'Could not find the native target in project.pbxproj — refusing to write a scheme with a guessed id.',
      'A scheme pointing at the wrong blueprint appears in Xcode and cannot build,\n'
      + 'which is harder to diagnose than no scheme at all.',
    );
  }
  const [, blueprintId, targetName] = target;

  const scheme = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion = "1500" version = "1.7">
   <BuildAction parallelizeBuildables = "YES" buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting = "YES" buildForRunning = "YES" buildForProfiling = "YES" buildForArchiving = "YES" buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${blueprintId}"
               BuildableName = "${targetName}.app"
               BlueprintName = "${targetName}"
               ReferencedContainer = "container:${targetName}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction buildConfiguration = "Debug" selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle = "0" useCustomWorkingDirectory = "NO" ignoresPersistentStateOnLaunch = "NO" debugDocumentVersioning = "YES" debugServiceExtension = "internal" allowLocationSimulation = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "${blueprintId}"
            BuildableName = "${targetName}.app"
            BlueprintName = "${targetName}"
            ReferencedContainer = "container:${targetName}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction buildConfiguration = "Release" shouldUseLaunchSchemeArgsEnv = "YES" savedToolIdentifier = "" useCustomWorkingDirectory = "NO" debugDocumentVersioning = "YES">
      <BuildableProductRunnable runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "${blueprintId}"
            BuildableName = "${targetName}.app"
            BlueprintName = "${targetName}"
            ReferencedContainer = "container:${targetName}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction buildConfiguration = "Release" revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
`;

  if (existsSync(schemePath) && readFileSync(schemePath, 'utf8') === scheme) return;
  mkdirSync(schemeDir, { recursive: true });
  writeFileSync(schemePath, scheme);
  note(`wrote a shared "${targetName}" scheme (xcodebuild -scheme ${targetName})`);
}

writeSharedScheme();

// ── 7. Signing team and Associated Domains — OPT-IN, via env ─────────────────
//
// Both of these were written off as "manual Xcode steps". They are not: they are
// plain build settings, and scripting them removes two error-prone trips through
// the Signing & Capabilities UI on every regenerated project.
//
// ⚠️ THEY ARE OPT-IN, AND THAT IS NOT TIMIDITY. Setting either unconditionally
// makes the project WORSE for anyone who has not done the matching Apple
// Developer Portal work:
//   · a DEVELOPMENT_TEAM you are not a member of fails signing outright;
//   · `com.apple.developer.associated-domains` fails signing with "Provisioning
//     profile doesn't include the ... entitlement" unless the App ID has the
//     Associated Domains capability enabled.
// Unset, the project behaves exactly as before — Xcode prompts for a team, and
// universal links simply do not work until someone asks for them.
const TEAM = process.env.IOS_DEVELOPMENT_TEAM?.trim();
const DOMAINS = process.env.IOS_ASSOCIATED_DOMAINS?.trim();

/**
 * Insert or replace a build setting in every configuration of the app target.
 *
 * Returns the number of configurations whose text actually CHANGED, not the
 * number visited. ⚠️ It counted visits first, so a second run with identical
 * env reported "2 changes" and rewrote the file — which made this script's own
 * change log untrustworthy, in a script whose whole job is to be re-run.
 */
function setAppBuildSetting(source, key, value) {
  let count = 0;
  const updated = source.replace(
    /(buildSettings = \{\n)([\s\S]*?)(\t\t\t\};)/g,
    (match, open, body, close) => {
      // Only the app target's configurations — identified by the setting that
      // only it carries. Editing the Pods configurations would be wrong and
      // would be silently overwritten by the next `pod install`.
      if (!body.includes('PRODUCT_BUNDLE_IDENTIFIER')) return match;
      const line = `\t\t\t\t${key} = ${value};\n`;
      const next = new RegExp(`^\\t{4}${key} = `, 'm').test(body)
        ? open + body.replace(new RegExp(`^\\t{4}${key} = [^\\n]*\\n`, 'm'), line) + close
        : open + line + body + close;
      if (next !== match) count += 1;
      return next;
    },
  );
  return { updated, count };
}

if (TEAM || DOMAINS) {
  let project = readFileSync(PBXPROJ, 'utf8');
  const before = project;

  if (TEAM) {
    if (!/^[A-Z0-9]{10}$/.test(TEAM)) {
      die(
        `IOS_DEVELOPMENT_TEAM="${TEAM}" is not a Team ID.`,
        'An Apple Team ID is 10 uppercase alphanumerics (Apple Developer →\n'
        + 'Membership details). Writing a wrong one produces a signing failure\n'
        + 'whose message does not mention this script.',
      );
    }
    const { updated, count } = setAppBuildSetting(project, 'DEVELOPMENT_TEAM', TEAM);
    if (!updated.includes(`DEVELOPMENT_TEAM = ${TEAM}`)) {
      die('Could not find the app target build configurations to set DEVELOPMENT_TEAM.');
    }
    project = updated;
    if (count) note(`set DEVELOPMENT_TEAM=${TEAM} on ${count} configuration(s)`);
  }

  if (DOMAINS) {
    const entries = DOMAINS.split(/[,\s]+/).filter(Boolean);
    const malformed = entries.filter((d) => !/^(applinks|webcredentials|activitycontinuation):/.test(d));
    if (malformed.length) {
      die(
        `IOS_ASSOCIATED_DOMAINS entries must carry a service prefix: ${malformed.join(', ')}`,
        'Expected e.g. `applinks:www.charitme.com`. A bare hostname is accepted by\n'
        + 'the plist and then silently does nothing.',
      );
    }

    const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>com.apple.developer.associated-domains</key>
\t<array>
${entries.map((d) => `\t\t<string>${d}</string>`).join('\n')}
\t</array>
</dict>
</plist>
`;
    const entPath = join(APP, 'App.entitlements');
    if (!existsSync(entPath) || readFileSync(entPath, 'utf8') !== entitlements) {
      writeFileSync(entPath, entitlements);
      note(`wrote App.entitlements (${entries.join(', ')})`);
    }

    const ENT_REF = 'CAFE0003000000000000ENTL';
    if (!project.includes('App.entitlements')) {
      project = project.replace(
        '/* End PBXFileReference section */',
        `\t\t${ENT_REF} /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
      );
      project = project.replace(
        /(\/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n)/,
        `$1\t\t\t\t${ENT_REF} /* App.entitlements */,\n`,
      );
    }
    // An entitlements file Xcode does not point at is inert — the capability
    // simply does not apply, with no error anywhere.
    const { updated, count } = setAppBuildSetting(project, 'CODE_SIGN_ENTITLEMENTS', 'App/App.entitlements');
    if (!updated.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements')) {
      die('Could not find the app target build configurations to set CODE_SIGN_ENTITLEMENTS.');
    }
    project = updated;
    if (count) note(`wired CODE_SIGN_ENTITLEMENTS on ${count} configuration(s)`);
  }

  if (project !== before) writeFileSync(PBXPROJ, project);
}

console.log(
  changes.length
    ? `\n✅ iOS project prepared (${changes.length} change${changes.length === 1 ? '' : 's'}).`
    : '\n✅ iOS project already prepared — nothing to do.',
);
console.log('\nNext, on macOS:');
// `cap open ios` opens App.xcworkspace, not App.xcodeproj. With CocoaPods the
// bare project does not build — opening the wrong one is the classic "missing
// Pods" failure — and `cap sync ios` is what runs `pod install`.
console.log('  npx cap sync ios     # runs pod install');
console.log('  npx cap open ios     # opens App.xcworkspace (NOT App.xcodeproj)');
console.log('  Signing & Capabilities → set your Team, then add Associated Domains:');
console.log('    applinks:www.charitme.com');
