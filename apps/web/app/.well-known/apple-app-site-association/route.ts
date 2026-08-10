import 'server-only';
import { NextResponse } from 'next/server';
import { appleAppSiteAssociation } from '../../../lib/app-store-links';

/**
 * The file iOS fetches to associate this domain with the App Store build, so a
 * shared campaign link opens the app instead of Safari.
 *
 * ⚠️ Three iOS-specific rules are easy to get wrong and all three fail silently
 * — the link simply opens in Safari and nothing anywhere says why:
 *
 *  1. **No `.json` extension.** The path is exactly
 *     `/.well-known/apple-app-site-association`.
 *  2. **`application/json` content type**, which is why this is a route handler.
 *  3. **No redirect.** iOS does not follow one. A `www` → apex redirect (or the
 *     reverse) breaks association, so whichever host the app claims must serve
 *     this file with a 200 directly.
 *
 * Returns 404 until `IOS_APP_ID` is set, for the reason given in
 * `lib/app-store-links.ts`: a file naming the wrong team is indistinguishable
 * from a provisioning problem, while a missing file names itself.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const association = appleAppSiteAssociation();
  if (!association) {
    return new NextResponse('Not configured', { status: 404, headers: { 'content-type': 'text/plain' } });
  }
  return NextResponse.json(association, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
}
