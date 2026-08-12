# Native shells — Play (TWA) and App Store (Capacitor)

Neither store accepts a URL, so something has to wrap the site. This is the
config and the build path for both. **Neither build can run in this repo's
sandbox** — Bubblewrap needs a JDK and the Android SDK, Capacitor's iOS build
needs Xcode on macOS — so what lives here is the configuration, generated to
match the web manifest exactly, plus the commands to run on a machine that has
the toolchains.

## Google Play — Trusted Web Activity

A TWA is the site running in a Chrome container with **no address bar**, provided
Digital Asset Links verifies. It is the intended route for a site like this: one
codebase, no second implementation to keep in sync.

`twa-manifest.json` at the repo root is generated to match `app/manifest.ts`
field for field. ⚠️ **`bubblewrap init` would otherwise fetch the live manifest
and prompt for each value interactively**, which is how the two drift.

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://www.charitme.com/manifest.webmanifest
# ^ answers come from twa-manifest.json; check the diff rather than retyping
bubblewrap build          # produces app-release-bundle.aab + app-release-signed.apk
```

### The step that decides whether it looks like an app

`bubblewrap build` prints the signing key's **SHA-256 fingerprint**. That value
must reach `ANDROID_SHA256_FINGERPRINT` in the site's environment, which is what
makes `/.well-known/assetlinks.json` serve instead of 404.

⚠️ **Once Play App Signing is enabled, the fingerprint you need is Google's, not
the local keystore's.** Read it from **Play Console → Setup → App integrity →
App signing key certificate**. Using the upload certificate is the single most
common way that file ends up present and never verifying, and the symptom is
indirect: the app installs and runs, but with a URL bar across the top — which is
exactly what gets a build reviewed as a repackaged website.

Verify before submitting:

```bash
curl -s https://www.charitme.com/.well-known/assetlinks.json   # must be 200 JSON
# then, on a device: install, and confirm no address bar appears
```

## App Store — Capacitor

`capacitor.config.ts` at the repo root points a native shell at the production
origin. `npx cap add ios` generates the Xcode project; it is **not** committed
because it is a build artifact regenerated from this config, and committing it
means merge conflicts in a `.pbxproj` nobody can read.

Capacitor is now a devDependency (it was documented here but never installed, so
`npx cap add ios` failed at the first step). The wrapper scripts exist because
the generated project is **incomplete on its own**:

```bash
npm install             # Capacitor is already in devDependencies
npm run ios:add         # cap add ios  + the prepare step
npm run ios:sync        # cap sync ios + the prepare step — after any config change
npm run ios:open        # requires macOS + Xcode; opens App.xcworkspace
```

Capacitor 7 uses **CocoaPods**, so the thing you open is `ios/App/App.xcworkspace`,
not `App.xcodeproj` — opening the bare project gives the classic "missing Pods"
build failure. `npx cap sync ios` runs `pod install` on macOS.

### ⚠️ Capacitor is pinned to v7, and the pin is load-bearing

v8 declares `engines: { node: ">=22.0.0" }`. `.node-version` pins **20.19.0** and
`.npmrc` sets `engine-strict=true`, so `npm ci` **fails** rather than warns —
which took out all five CI jobs and Vercel deploys, since both read those same two
files. v7 requires only `>=20.0.0`.

This is invisible on a dev machine running a newer Node: install, build and the
full test suite all pass there. `apps/web/__tests__/pinned-node-engines.test.ts`
checks every dependency's declared range against the **pinned** version rather
than `process.version`, which is the only form of the check that holds no matter
who runs it. Do not bump the Capacitor major without moving the Node pin first —
that changes the production runtime.

### What `ios:prepare` fixes, and why it is not optional

`ios/` is a build artifact and is not committed, so **no project-level
configuration survives regeneration**. `scripts/prepare-ios.mjs` reapplies it.
Every item below was measured on a generated project:

| Missing | Consequence |
|---|---|
| `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` | **App is terminated by iOS** the moment a user taps "Take Photo" on any `<input type="file" accept="image/*">` — campaign creation, profile, admin |
| `NSLocationWhenInUseUsageDescription` | Same, for `navigator.geolocation` on `/nearby` |
| `PrivacyInfo.xcprivacy` not in the target | Upload **rejected** by App Store Connect, after a successful archive |
| App icon | Ships **Capacitor's own logo** — a finished 1024×1024 image, so nothing looks unfinished |
| Alpha channel in the icon | "The app icon can't be transparent nor contain an alpha channel" — every web icon is RGBA, so it is rendered from `icon-source.svg` and flattened |
| `ITSAppUsesNonExemptEncryption` | Every upload held on the export-compliance question |

The script is idempotent, verifies its own `.pbxproj` edits rather than assuming
a string replace landed, and refuses to report success if the project was not
modified. `apps/web/__tests__/ios-shell-readiness.test.ts` guards it — including
a scan of the web source for native APIs, so adding one without a usage string
is a red test rather than a crash report.

### ⚠️ `webDir` must not be a build directory

It was `apps/web/.next`, on the reasoning that `webDir` is unused while
`server.url` is set. The CLI copies it into the app bundle regardless: **2.0 GB
and 115 seconds**, of which 2.0 GB was `.next/cache` and 56 MB was compiled
server code — shipped to every device and never loaded. (No secret *values* were
inlined; the matches for `SUPABASE_SERVICE_ROLE_KEY` were env-var names in error
paths.) It now points at `native/www`, one self-contained page, which
`server.errorPath` shows when the site cannot be reached: 8 KB, 0.9 seconds.

### ⚠️ Guideline 4.2 — the risk this does not solve

Apple rejects apps that are "simply a repackaged website" under **minimum
functionality**. A Capacitor shell pointed at a URL is precisely that shape, and
this is the most likely rejection for this submission. Nothing in this repo fixes
it; it needs native capability the web app cannot provide on its own. In rough
order of effort against reviewer-visible value:

| Capability | Plugin | Why it reads as native |
|---|---|---|
| Push notifications | `@capacitor/push-notifications` | Donation alerts for organisers — a genuine reason to have the app |
| Native share sheet | `@capacitor/share` | Campaign sharing is already core to the product |
| Biometric unlock | `capacitor-native-biometric` | Guards a dashboard holding payout details |
| Haptics | `@capacitor/haptics` | Cheap, small, reviewer-visible on donation confirmation |

Push is the strongest: it is the one capability the site genuinely cannot do on
iOS Safari, and organisers actually want it.

### Confirm it yourself: `npm run ios:verify`

`scripts/prepare-ios.mjs` applies the configuration; `scripts/verify-ios-project.mjs`
grades the result. They are separate on purpose — a script that grades its own
work reports success on whatever it happened to produce.

```bash
npm run ios:add      # generate + prepare
npm run ios:verify   # 20 checks against the generated project
npm run ios:open     # macOS + Xcode
```

Every check corresponds to a failure that is silent until it is expensive: a
storyboard class nothing compiles (builds fine, then crashes at launch with
"Unknown class in Interface Builder file"), a missing usage description (iOS
terminates the process), a privacy manifest present on disk but absent from the
`.ipa` (only App Store Connect tells you), a missing shared scheme (invisible in
the GUI, fatal to `xcodebuild`). Mutation-tested: dropping the camera string,
deleting the scheme, or un-bundling the privacy manifest each fails it.

It prints what it does **not** cover, every run: compilation, code signing, the
archive, upload, and Associated Domains.

### Verified from Linux — including `pod install`

More of this is checkable without a Mac than you would expect, and it was checked
rather than assumed:

| Verified here | How |
|---|---|
| Project generates and regenerates cleanly | `npm run ios:add` from scratch |
| Every file the `.pbxproj` references exists | parsed the project, resolved each `PBXFileReference` |
| `Info.plist`, `PrivacyInfo.xcprivacy`, storyboards, all `Contents.json` parse | Python `plistlib` / `ElementTree` / `json` |
| Bundle id matches `appId`; deployment target consistent with the Podfile | both read from the generated project |
| App icon is 1024×1024 with **no alpha** | `sharp` metadata |
| Launch screen is dark, not the white vendor default | `sharp` channel stats |
| Shared scheme points at the **real** target | compared the scheme's `BlueprintIdentifier` to the `PBXNativeTarget` id |
| **The Podfile actually resolves** | `pod install` — CocoaPods runs on Linux |
| The workspace references both projects, and both `xcconfig`s exist | read `contents.xcworkspacedata` and resolved each referenced path |
| All of the above survives `pod install`, which rewrites the `.pbxproj` | re-ran the audit afterwards |

CocoaPods needs two things on Linux: a UTF-8 locale (`LANG=C.UTF-8`, else it dies
in `unicode_normalize`) and `--allow-root` if the shell is root. Neither applies
on a Mac. Note the Podfile references `../../node_modules/@capacitor/ios`, so
**`npm install` must have run on the build machine** before `pod install`.

**What genuinely cannot be checked without Xcode:** compilation, code signing,
the archive, and upload. Everything up to those is verified above.

### Universal links

`IOS_APP_ID` (`TEAMID.bundle.id`) makes
`/.well-known/apple-app-site-association` serve. Then in Xcode: Signing &
Capabilities → Associated Domains → `applinks:www.charitme.com`.

⚠️ iOS **does not follow redirects** for that file. Whichever host the app claims
must serve it with a 200 directly — an apex↔`www` redirect silently breaks
association, and the only symptom is that links keep opening in Safari.

## What is deliberately NOT here

- **No committed `ios/` or `android/` directory.** Both are generated. Committing
  them adds thousands of lines of unreadable project files that conflict on every
  merge, in a repo several agents write to hourly.
- **No signing keys, keystores or provisioning profiles.** They are secrets, and
  a keystore in git is a supply-chain problem, not a convenience.
- **No `@capacitor/*` dependencies in `apps/web/package.json`.** They are build
  tooling for a native shell, not runtime dependencies of the website, and adding
  them would put native plugins into every Vercel deploy's install step.
