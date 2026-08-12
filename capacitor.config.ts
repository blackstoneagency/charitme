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
  // ⚠️ NOT the Next.js build directory, and that is the whole point.
  //
  // This read `apps/web/.next`, on the reasoning that `webDir` is "unused while
  // `server.url` is set". The CLI does not agree: `npx cap add ios` COPIES
  // `webDir` into the app bundle whether or not the WebView will ever read it.
  // Measured — 2.0 GB and 115 seconds, of which 2.0 GB was `.next/cache` and
  // 56 MB was compiled server code, shipped to every device to be ignored.
  // (No secret values were inlined; the matches for `SUPABASE_SERVICE_ROLE_KEY`
  // were env-var names in error paths. The cost was size and shipping the server
  // build, not a leaked key.)
  //
  // `native/www` holds one self-contained page instead, which `server.errorPath`
  // below turns into something useful.
  webDir: 'native/www',

  server: {
    url: 'https://www.charitme.com',
    // Shown when the WebView cannot reach the site at all — offline, captive
    // portal, outage. Without it iOS renders its own network error page, which
    // reads as "this app is broken" rather than "you have no signal".
    errorPath: 'index.html',
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
