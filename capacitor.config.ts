/**
 * Capacitor shell for the App Store build. See `docs/native-shells.md`.
 *
 * This file is config only — `npx cap add ios` generates the Xcode project from
 * it on a macOS build machine. The generated `ios/` directory is intentionally
 * NOT committed: it is a build artifact, and a `.pbxproj` conflicting on every
 * merge in a repo several agents write to hourly costs more than regenerating it.
 *
 * ⚠️ `server.url` points the shell at the live site rather than bundling a static
 * export, and that is a real trade with a real risk.
 *
 *   · It has to be this way: the app is a Next.js server — RSC, route handlers,
 *     Stripe webhooks, `force-dynamic` pages. `next export` cannot produce it,
 *     so there is no offline bundle to ship.
 *   · The cost is Guideline 4.2. A web view pointed at a URL is the exact shape
 *     Apple rejects as "a repackaged website". Shipping this config alone is
 *     likely to be rejected — the mitigation is native capability, listed in
 *     `docs/native-shells.md`, not anything in this file.
 *
 * Do not treat the presence of this file as "the iOS app is ready". It is the
 * starting point for a build that still needs native features to pass review.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.charitme.app',
  appName: 'CharitMe',
  // Unused while `server.url` is set, but required by the CLI, and it is where a
  // future static build would land.
  webDir: 'apps/web/.next',

  server: {
    url: 'https://www.charitme.com',
    // No cleartext. The site is HTTPS-only and an app that permits plain HTTP
    // will happily load a downgraded page on a hostile network — with a session
    // cookie and a donation form on it.
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },

  ios: {
    // Matches the manifest's `background_color` and the app's dark default.
    // A white shell behind a black page flashes on every launch and on every
    // rubber-band scroll past the top.
    backgroundColor: '#000000',
    // The site sets its own theme; letting iOS invert it would fight the
    // in-app toggle.
    preferredContentMode: 'mobile',
  },

  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      // The web app paints its own first screen; a long native splash on top of
      // that is two loading states in a row.
      launchShowDuration: 500,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
};

export default config;
