import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslator } from '../../lib/locale-server';
import { getDonationOutcome } from '../../lib/donation-outcome-server';
import { totalChargedCents } from '../../lib/donation-outcome-core';
import { formatMoneyShort } from '@shared/currencies';
import CopyField from './CopyField';
import { flowShell, panel, primaryAction, outlineAction, quietLink, dl, dt, dd } from './flow-ui';

export const metadata: Metadata = {
  title: 'Thank you',
  // A receipt page has no business in search results, and the URL carries a
  // Stripe session id that authorizes reading one.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Step 9 of 12 — donation successful.
 *
 * Everything shown here is resolved server-side from the Stripe checkout session
 * id in the URL (see `donation-outcome-server.ts`). Nothing is read from any
 * other query parameter: the old version of this page took `?amount=`, which is
 * visitor-editable, and rendered an official-looking confirmation for a number
 * nobody had verified.
 */
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string; campaign?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [t, outcome] = await Promise.all([getTranslator(), getDonationOutcome(sp.session_id)]);

  const session = sp.session_id ?? '';
  const campaignHref = outcome
    ? `/campaigns/${outcome.campaignSlug}`
    : sp.campaign ? `/campaigns/${sp.campaign}` : '/campaigns';

  return (
    <main id="main-content" style={flowShell}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 72, height: 72, borderRadius: 999, marginBottom: 22,
          background: 'var(--tint-green)', color: 'var(--green-text)', fontSize: 34,
        }}
      >
        ✓
      </span>

      <h1 style={{ fontSize: 'clamp(28px,5vw,38px)', fontWeight: 850, color: 'var(--t1)', margin: '0 0 10px' }}>
        {t('thanks.title')}
      </h1>
      <p style={{ fontSize: 17, color: 'var(--t2)', margin: '0 0 8px' }}>{t('thanks.subtitle')}</p>

      {outcome?.status === 'pending' ? (
        <p style={{ fontSize: 14.5, color: 'var(--t3)', margin: '0 0 30px', lineHeight: 1.55 }}>
          {t('thanks.finalising')}
        </p>
      ) : (
        <p style={{ fontSize: 14.5, color: 'var(--t3)', margin: '0 0 30px', lineHeight: 1.55 }}>
          {outcome?.donorEmail
            ? <>{t('thanks.sent_to')} <strong style={{ color: 'var(--t2)' }}>{outcome.donorEmail}</strong></>
            : t('thanks.receipt_sent')}
        </p>
      )}

      {outcome && (
        <section aria-label={t('thanks.summary')} style={{ ...panel, marginBottom: 26 }}>
          <dl style={dl}>
            <dt style={dt}>{t('thanks.cause')}</dt>
            <dd style={dd}>{outcome.campaignTitle}</dd>
            <dt style={dt}>{t('donate.amount')}</dt>
            <dd style={{ ...dd, fontWeight: 750, fontSize: 17 }}>
              {formatMoneyShort(outcome.amountCents, outcome.currency)}
            </dd>
            {totalChargedCents(outcome) !== outcome.amountCents && (
              <>
                <dt style={dt}>{t('donate.total')}</dt>
                <dd style={dd}>{formatMoneyShort(totalChargedCents(outcome), outcome.currency)}</dd>
              </>
            )}
            {outcome.createdAt && (
              <>
                <dt style={dt}>{t('thanks.date')}</dt>
                <dd style={dd}>
                  {new Date(outcome.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </dd>
              </>
            )}
          </dl>

          {outcome.transactionId && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--b1)' }}>
              <CopyField
                label={t('thanks.transaction_id')}
                value={outcome.transactionId}
                copyLabel={t('action.copy')}
                copiedLabel={t('action.copied')}
              />
            </div>
          )}
        </section>
      )}

      <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Hidden while pending: there is no donation row yet, so the receipt
            screen would have nothing to address. It appears on reload. */}
        {outcome?.donationId && (
          <Link href={`/thank-you/receipt?session_id=${encodeURIComponent(session)}`} style={primaryAction}>
            {t('thanks.view_receipt')}
          </Link>
        )}
        {outcome && (
          <Link href={`/thank-you/share?session_id=${encodeURIComponent(session)}`} style={outlineAction}>
            {t('thanks.share_title')}
          </Link>
        )}
        {!outcome && (
          <Link href={campaignHref} style={primaryAction}>{t('thanks.back_to_cause')}</Link>
        )}
      </div>

      {outcome && (
        <p style={{ margin: '18px 0 0' }}>
          <Link href={campaignHref} style={quietLink}>{t('thanks.back_to_cause')}</Link>
        </p>
      )}
    </main>
  );
}
