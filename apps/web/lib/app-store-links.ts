import 'server-only';

/**
 * The two association files the app stores require, built from configuration
 * only.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY BOTH RETURN `null` UNTIL CONFIGURED
 *
 * Each file asserts a cryptographic identity: `assetlinks.json` names the
 * SHA-256 of the certificate Google Play signs the Android build with, and
 * `apple-app-site-association` names `TEAMID.bundle.id` from the Apple Developer
 * account. Neither is derivable from this repository, and neither has a harmless
 * placeholder.
 *
 * A file containing an invented fingerprint is worse than no file. It does not
 * fail loudly — Android reports "verification did not succeed" and iOS silently
 * declines to associate the domain, both of which read as a store-console
 * problem and send you to look in the wrong place. An absent file says exactly
 * what is wrong: it is not configured yet.
 *
 * This is the same rule the contact page follows for a phone number it does not
 * have, and for the same reason: a confident wrong answer costs more than a
 * missing one.
 */

/** Android package name, e.g. `com.charitme.app`. */
const ANDROID_PACKAGE = process.env.ANDROID_PACKAGE_NAME?.trim();

/**
 * SHA-256 signing fingerprint, uppercase hex, colon-separated.
 *
 * Play App Signing owns the release key, so this is read from
 * Play Console → Setup → App integrity, NOT from a local keystore. Using the
 * upload certificate here is the single most common way this file ends up
 * present and wrong.
 */
const ANDROID_FINGERPRINT = process.env.ANDROID_SHA256_FINGERPRINT?.trim();

/** `TEAMID.bundle.id`, e.g. `AB12CD34EF.com.charitme.app`. */
const IOS_APP_ID = process.env.IOS_APP_ID?.trim();

/** Reject a fingerprint that is not one, rather than serving it. */
const FINGERPRINT_SHAPE = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i;
/** A team id is 10 alphanumerics; the bundle id is reverse-DNS after it. */
const APP_ID_SHAPE = /^[0-9A-Z]{10}\.[A-Za-z0-9.-]+$/i;

export interface AssetLinkStatement {
  relation: string[];
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
}

export function androidAssetLinks(): AssetLinkStatement[] | null {
  if (!ANDROID_PACKAGE || !ANDROID_FINGERPRINT) return null;
  // A malformed fingerprint is a configuration mistake, not a reason to serve
  // something that cannot verify. Same outcome as unset: 404.
  if (!FINGERPRINT_SHAPE.test(ANDROID_FINGERPRINT)) return null;
  return [
    {
      relation: [
        'delegate_permission/common.handle_all_urls',
        // Required for a TWA to run without the address bar. `handle_all_urls`
        // alone gives app links but leaves the browser chrome in place.
        'delegate_permission/common.get_login_creds',
      ],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: [ANDROID_FINGERPRINT.toUpperCase()],
      },
    },
  ];
}

export interface AppleAppSiteAssociation {
  applinks: { apps: string[]; details: { appID: string; paths: string[] }[] };
}

export function appleAppSiteAssociation(): AppleAppSiteAssociation | null {
  if (!IOS_APP_ID || !APP_ID_SHAPE.test(IOS_APP_ID)) return null;
  return {
    applinks: {
      // Always empty — an Apple requirement, not an oversight.
      apps: [],
      details: [
        {
          appID: IOS_APP_ID,
          /*
           * ⚠️ Claim only what the app can actually handle.
           *
           * `["*"]` is tempting and wrong: it hands the app every URL on the
           * domain, including `/api/*` and the Stripe return paths. A universal
           * link that swallows a payment redirect strands the donor in an app
           * screen that cannot complete the checkout the browser was mid-way
           * through, and the money is already moving. The exclusions come first
           * because iOS takes the LAST match, not the first.
           */
          paths: [
            'NOT /api/*',
            'NOT /thank-you/*',
            'NOT /auth/*',
            'NOT /.well-known/*',
            '/campaigns/*',
            '/causes/*',
            '/donate/*',
            '/c/*',
            '/',
          ],
        },
      ],
    },
  };
}
