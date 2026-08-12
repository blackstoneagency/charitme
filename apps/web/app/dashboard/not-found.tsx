import type { Metadata } from 'next';
import { BtnLink, EmptyState } from '../../components/ui';
import { CharitMeShell, TopBar } from '../../components/CharitMeShellServer';

export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: true },
};

/**
 * The dashboard's own 404.
 *
 * ⚠️ WHY THIS EXISTS. `app/dashboard/campaigns/[id]/page.tsx` calls `notFound()`
 * whenever the campaign is missing or is not this user's — an everyday outcome:
 * a deleted campaign, a stale bookmark, a link from someone else's account. With
 * only the root `app/not-found.tsx` to catch it, a signed-in organizer landed on
 * the MARKETING 404: no sidebar, no header, no account menu, and two links that
 * both lead out of the dashboard ("Back to home", "Browse campaigns"). The way
 * back into their own dashboard was the browser's back button.
 *
 * Measured with the signed-in stub: `/dashboard/campaigns/<unknown-id>` was the
 * one route out of 56 that rendered no `.kf-logo` and no account controls, while
 * its `page.tsx` contains both `CharitMeShell` and `TopBar` — so a source-level
 * check passes and the rendered page is still headerless. A `notFound()` never
 * reaches its own page's JSX.
 */
export default function DashboardNotFound() {
  return (
    <CharitMeShell active="">
      <TopBar title="Not found" subtitle="That page is not available on your account." />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px' }}>
        <EmptyState
          icon="🔍"
          title="404 — Not found"
          body="This page doesn't exist, or it belongs to a campaign that has been removed or isn't on your account."
          action={
            <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <BtnLink href="/dashboard" variant="primary">Back to dashboard</BtnLink>
              <BtnLink href="/dashboard/campaigns" variant="secondary">My campaigns</BtnLink>
            </div>
          }
        />
      </div>
    </CharitMeShell>
  );
}
