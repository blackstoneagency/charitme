import { assertCampaignExists } from './get-campaign';

/**
 * Existence gate for the campaign detail route — this is what makes a missing
 * campaign return a real 404 instead of a soft-404 (200).
 *
 * Why it lives in a layout rather than the page: `loading.tsx` wraps the *page*
 * in a Suspense boundary, so Next streams the shell and commits HTTP 200 before
 * the page body ever runs. A `notFound()` in the page then renders the correct
 * UI but can no longer change the status. A layout renders *outside* that
 * boundary, so the check happens before the response is committed.
 *
 * This keeps `[slug]/loading.tsx` — the skeleton on the donation path — while
 * still serving correct 404s to crawlers. The gate reuses the React-cache()d
 * `getCampaign`, so it shares one query with generateMetadata and the page.
 */
export default async function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await assertCampaignExists(slug);
  return <>{children}</>;
}
