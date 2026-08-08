import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslator } from '../../../lib/locale-server';
import { getDonationOutcome } from '../../../lib/donation-outcome-server';
import { totalChargedCents, receiptReference } from '../../../lib/donation-outcome-core';
import { formatMoneyShort } from '@shared/currencies';
import { flowShell, panel, primaryAction, outlineAction, dl, dt, dd } from '../flow-ui';

export const metadata: Metadata = {
  title: 'Your receipt',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Step 10 of 12 — the receipt.
 *
 * ⚠️ **The tax-deductibility notice is rendered only when a `tax_receipts` row
 * exists for this donation.** The reference artwork prints "CharitMe is a
 * 501(c)(3) nonprofit. Your donation may be tax-deductible" as fixed furniture
 * on every receipt. That is a statement about a specific legal entity and a
 * specific donation, and printing it unconditionally would put it on receipts
 * for campaigns run by individuals, where it is false and the donor may act on
 * it at filing time. So the claim appears with the nonprofit's own name and EIN
 * beside it, or it does not appear.
 */
export default async function ReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [t, outcome] = await Promise.all([
    getTranslator(),
    // The only screen that needs the card brand, so the only one that pays for
    // the expanded Stripe lookup.
    getDonationOutcome(sp.session_id, { withPaymentMethod: true }),
  ]);

  // No verified payment behind this URL — there is no receipt to show, and a
  // page explaining that is a page that invites guessing at session ids.
  if (!outcome) notFound();

  const session = sp.session_id ?? '';
  const reference = outcome.receiptNumber ?? receiptReference(outcome.transactionId);
  const total = totalChargedCents(outcome);

  return (
    <main id="main-content" style={flowShell}>
      <h1 style={{ fontSize: 'clamp(26px,4.5vw,34px)', fontWeight: 850, color: 'var(--t1)', margin: '0 0 8px' }}>
        {t('thanks.your_receipt')}
      </h1>
      <p style={{ fontSize: 15.5, color: 'var(--t2)', margin: '0 0 26px' }}>{t('thanks.receipt_intro')}</p>

      <section aria-labelledby="receipt-heading" style={{ ...panel, marginBottom: 22 }}>
        <h2 id="receipt-heading" style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 750, color: 'var(--t1)' }}>
          {t('thanks.summary')}
        </h2>

        <dl style={dl}>
          {outcome.donorName && (
            <>
              <dt style={dt}>{t('thanks.donor')}</dt>
              <dd style={dd}>{outcome.donorName}</dd>
            </>
          )}
          {outcome.donorEmail && (
            <>
              <dt style={dt}>{t('auth.email')}</dt>
              <dd style={dd}>{outcome.donorEmail}</dd>
            </>
          )}
          <dt style={dt}>{t('thanks.cause')}</dt>
          <dd style={dd}>{outcome.campaignTitle}</dd>
          {outcome.createdAt && (
            <>
              <dt style={dt}>{t('thanks.date')}</dt>
              <dd style={dd}>
                {new Date(outcome.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </dd>
            </>
          )}
          {/* Omitted rather than guessed when Stripe did not report a method —
              a receipt naming the wrong instrument is a support ticket. */}
          {outcome.paymentMethodLabel && (
            <>
              <dt style={dt}>{t('thanks.payment_method')}</dt>
              <dd style={dd}>{outcome.paymentMethodLabel}</dd>
            </>
          )}
          {reference && (
            <>
              <dt style={dt}>{t('thanks.reference')}</dt>
              <dd style={{ ...dd, fontFamily: 'var(--mono, monospace)', fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>
                {reference}
              </dd>
            </>
          )}
        </dl>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--b1)' }}>
          <dl style={dl}>
            <dt style={dt}>{t('donate.amount')}</dt>
            <dd style={dd}>{formatMoneyShort(outcome.amountCents, outcome.currency)}</dd>
            {outcome.tipCents > 0 && (
              <>
                <dt style={dt}>{t('donate.tip_title')}</dt>
                <dd style={dd}>{formatMoneyShort(outcome.tipCents, outcome.currency)}</dd>
              </>
            )}
            {outcome.processingFeeCents > 0 && (
              <>
                <dt style={dt}>{t('donate.processing_fee')}</dt>
                <dd style={dd}>{formatMoneyShort(outcome.processingFeeCents, outcome.currency)}</dd>
              </>
            )}
            <dt style={{ ...dt, fontWeight: 750, color: 'var(--t1)' }}>{t('donate.total')}</dt>
            <dd style={{ ...dd, fontWeight: 800, fontSize: 17 }}>{formatMoneyShort(total, outcome.currency)}</dd>
          </dl>
        </div>

        {outcome.taxDeductible && outcome.nonprofitName && outcome.nonprofitEin && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--b1)' }}>
            {outcome.taxReceiptAmountCents !== null && (
              <dl style={{ ...dl, marginBottom: 10 }}>
                <dt style={{ ...dt, fontWeight: 750, color: 'var(--t1)' }}>{t('thanks.tax_deductible_amount')}</dt>
                <dd style={{ ...dd, fontWeight: 800 }}>
                  {formatMoneyShort(outcome.taxReceiptAmountCents, outcome.currency)}
                </dd>
              </dl>
            )}
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6 }}>
              {outcome.nonprofitName} is a registered nonprofit (EIN {outcome.nonprofitEin}). No goods or
              services were provided in exchange for this contribution. Keep this receipt for your records.
            </p>
          </div>
        )}
      </section>

      <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a
          href={`/api/donations/receipt/session?session_id=${encodeURIComponent(session)}`}
          // `download` and a matching Content-Disposition: the donor keeps their
          // place in the flow instead of navigating into a document.
          download
          style={primaryAction}
        >
          {t('thanks.download_receipt')}
        </a>
        <Link href={`/thank-you/share?session_id=${encodeURIComponent(session)}`} style={outlineAction}>
          {t('thanks.share_title')}
        </Link>
      </div>
    </main>
  );
}
