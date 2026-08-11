import type { Metadata } from 'next';
import { BtnLink, EmptyState } from '../../components/ui';
import { CharitMeShell, TopBar } from '../../components/CharitMeShellServer';

export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: true },
};

/**
 * The admin console's own 404.
 *
 * ⚠️ Without this, `notFound()` inside /admin falls through to the root
 * `app/not-found.tsx` — the MARKETING 404. An admin chasing a transaction that
 * has been refunded away, or following a stale link, lands on a page with no
 * sidebar, no header, no account menu, and two links that both leave the console
 * ("Back to home", "Browse campaigns"). The route back into admin is the
 * browser's back button.
 *
 * `payments/campaign-flows/[campaignId]/transactions/[transactionId]` is the
 * page that reaches it today. A source-level check on that file passes — it
 * mounts the shell perfectly well — because `notFound()` short-circuits before
 * any of its JSX runs. This is the same defect the dashboard had, and it is
 * invisible to anything that reads `page.tsx` rather than the rendered page.
 */
export default function AdminNotFound() {
  return (
    <CharitMeShell active="" mode="admin">
      <TopBar title="Not found" subtitle="That record is not available." />
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px' }}>
        <EmptyState
          icon="🔍"
          title="404 — Not found"
          body="This page doesn't exist, or the record it points to has been removed."
          action={
            <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <BtnLink href="/admin" variant="primary">Back to admin</BtnLink>
              <BtnLink href="/admin/campaigns" variant="secondary">All campaigns</BtnLink>
            </div>
          }
        />
      </div>
    </CharitMeShell>
  );
}
