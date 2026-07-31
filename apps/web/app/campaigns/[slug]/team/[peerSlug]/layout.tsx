import { assertPeerPageExists } from './get-peer';

/**
 * Existence gate for a supporter's fundraising page — this is what makes an
 * unknown peer slug return a real 404 instead of a soft-404 (200).
 *
 * Same mechanism, and same reason, as `app/campaigns/[slug]/layout.tsx`:
 * `[slug]/loading.tsx` wraps this subtree in a Suspense boundary, so Next
 * commits the status before the page body runs. Layouts render outside that
 * boundary. Measured: without this file the wrong-campaign URL answered 200 with
 * 404 content.
 *
 * The parent layout already asserts the CAMPAIGN exists; this adds the peer, and
 * critically that the peer belongs to THAT campaign — `peer_fundraisers.slug` is
 * unique platform-wide, so every campaign slug would otherwise serve every
 * supporter's page.
 *
 * Reuses the React-cache()d `getPeerPage`, so the gate shares one query with
 * generateMetadata and the page body.
 */
export default async function PeerFundraiserLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; peerSlug: string }>;
}) {
  const { slug, peerSlug } = await params;
  await assertPeerPageExists(slug, peerSlug);
  return <>{children}</>;
}
