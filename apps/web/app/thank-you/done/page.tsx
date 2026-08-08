import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslator } from '../../../lib/locale-server';
import { getDonationOutcome } from '../../../lib/donation-outcome-server';
import { getUser } from '../../../lib/auth';
import { flowShell, primaryAction, outlineAction, quietLink } from '../flow-ui';

export const metadata: Metadata = {
  title: 'Your support matters',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Step 12 of 12 — back to the campaign.
 *
 * ⚠️ **"Go to dashboard" renders only for a signed-in donor.** The artwork shows
 * it as a fixed third link, but most donors give as guests: `middleware.ts`
 * redirects an unauthenticated visitor from `/dashboard` to
 * `/login?next=/dashboard`, so for them that link ends a successful donation at
 * a sign-in wall. A link that bounces the person who just gave money is worse
 * than one fewer link.
 */
export default async function DonationDonePage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [t, outcome, user] = await Promise.all([
    getTranslator(),
    getDonationOutcome(sp.session_id),
    getUser(),
  ]);
  if (!outcome) notFound();

  return (
    <main id="main-content" style={flowShell}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 76, height: 76, borderRadius: 999, marginBottom: 22,
          background: 'var(--tint-violet)', color: 'var(--brand-text)', fontSize: 34,
        }}
      >
        ♥
      </span>

      <h1 style={{ fontSize: 'clamp(26px,4.5vw,34px)', fontWeight: 850, color: 'var(--t1)', margin: '0 0 8px' }}>
        {t('thanks.support_matters')}
      </h1>
      <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: '0 0 28px' }}>
        {t('thanks.support_matters_body')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, maxWidth: 340, margin: '0 auto', minWidth: 0 }}>
        <Link href={`/campaigns/${outcome.campaignSlug}`} style={primaryAction}>
          {t('thanks.view_campaign')}
        </Link>
        <Link href="/causes" style={outlineAction}>
          {t('cause.browse_all')}
        </Link>
        {user && (
          <Link href="/dashboard" style={{ ...quietLink, marginTop: 4 }}>
            {t('nav.dashboard')}
          </Link>
        )}
      </div>
    </main>
  );
}
