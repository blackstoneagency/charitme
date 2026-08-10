import 'server-only';
import { NextResponse } from 'next/server';
import { androidAssetLinks } from '../../../lib/app-store-links';

/**
 * Digital Asset Links — the file Android fetches to decide whether this site
 * and the Play Store app are the same publisher.
 *
 * It is what makes a Trusted Web Activity open WITHOUT a browser address bar,
 * and what makes `charitme.com/campaigns/x` open in the app instead of Chrome.
 * Without it a TWA still installs and runs, but shows a URL bar across the top —
 * which is how a store reviewer decides an app is a repackaged website.
 *
 * ⚠️ It returns 404 until the signing fingerprint is configured, and that is
 * deliberate. The fingerprint is a SHA-256 of the certificate Play signs the app
 * with; there is no way to derive it here and no placeholder that is harmless.
 * A file containing a made-up fingerprint does not fail loudly — it fails as
 * "verification did not succeed", which reads like a Play Console problem and
 * sends you looking in the wrong place. Absent is diagnosable; wrong is not.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const links = androidAssetLinks();
  if (!links) {
    return new NextResponse('Not configured', { status: 404, headers: { 'content-type': 'text/plain' } });
  }
  return NextResponse.json(links, {
    headers: {
      // Android requires application/json and will not follow a redirect to get
      // it. Next serves this route's JSON directly, which is why it is a route
      // handler rather than a rewrite.
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
