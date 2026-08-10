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

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios        # requires macOS + Xcode
```

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
