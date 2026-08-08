import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslator } from '../../../lib/locale-server';
import { getDonationOutcome } from '../../../lib/donation-outcome-server';
import { shareMessage } from '../../../lib/donation-outcome-core';
import { getAppOrigin } from '../../../lib/auth-config';
import ShareSupport from './ShareSupport';
import { flowShell, panel, primaryAction, outlineAction } from '../flow-ui';

export const metadata: Metadata = {
  title: 'Share your support',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Step 11 of 12 — share your support.
 *
 * The campaign id comes from the resolved donation, never from the URL: this
 * screen writes `share_events` rows attributed to a campaign, and a
 * caller-supplied id would let anyone inflate another campaign's share numbers.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [t, outcome] = await Promise.all([getTranslator(), getDonationOutcome(sp.session_id)]);
  if (!outcome || !outcome.campaignId) notFound();

  const session = sp.session_id ?? '';
  const campaignUrl = `${getAppOrigin()}/campaigns/${outcome.campaignSlug}`;
  const nextHref = `/thank-you/done?session_id=${encodeURIComponent(session)}`;

  return (
    <main id="main-content" style={flowShell}>
      <h1 style={{ fontSize: 'clamp(26px,4.5vw,34px)', fontWeight: 850, color: 'var(--t1)', margin: '0 0 8px' }}>
        {t('thanks.share_title')}
      </h1>
      <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: '0 0 24px' }}>{t('thanks.share_body')}</p>

      <section style={{ ...panel, marginBottom: 22 }}>
        <ShareSupport
          campaignId={outcome.campaignId}
          campaignUrl={campaignUrl}
          message={shareMessage(outcome.campaignTitle, campaignUrl)}
          copyLabel={t('action.copy')}
          copiedLabel={t('action.copied')}
        />
      </section>

      {/* Skip and Done are two buttons in the artwork and would otherwise point
          at the same URL, which is a dead control wearing a second label. Skip
          means "I am finished here" and goes straight back to the campaign;
          Done continues to the last step. Each destination is reachable exactly
          one way. */}
      <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href={`/campaigns/${outcome.campaignSlug}`} style={outlineAction}>{t('thanks.share_skip')}</Link>
        <Link href={nextHref} style={primaryAction}>{t('thanks.share_done')}</Link>
      </div>
    </main>
  );
}
