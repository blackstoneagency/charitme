import type { Metadata } from 'next';
import Link from 'next/link';
import { stripe } from '../../lib/stripe';
import { supabaseAdmin } from '../../lib/supabase';
import { getTranslator } from '../../lib/locale-server';
import { formatMoneyShort } from '@shared/currencies';

export const metadata: Metadata = {
  title: 'Thank you',
  // A receipt page has no business in search results, and the URL carries a
  // Stripe session id.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Receipt = {
  amountCents: number;
  createdAt: string;
  campaignTitle: string;
  campaignSlug: string;
  reference: string;
};

/**
 * Resolve the real donation behind a Stripe checkout session.
 *
 * `donations` has `stripe_payment_intent_id` but no session-id column, and DDL is
 * blocked, so the session is exchanged for its payment intent through Stripe and
 * the donation is looked up by that. A read-only Stripe call — it retrieves, it
 * never charges.
 *
 * Returns null on ANY failure, and the page then shows a confirmation without a
 * summary. That matters more than it looks: the old success URL carried
 * `?amount=` in the query string, which is visitor-editable. Rendering a
 * "Donation Summary" from a URL parameter would produce an official-looking
 * receipt for a number nobody verified. Verified data or no data.
 */
async function resolveReceipt(sessionId: string | undefined): Promise<Receipt | null> {
  if (!sessionId || !sessionId.startsWith('cs_')) return null;
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const intent = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    if (!intent) return null;

    const { data, error } = await supabaseAdmin
      .from('donations')
      .select('amount_cents, created_at, campaigns:campaign_id(title, slug)')
      .eq('stripe_payment_intent_id', intent)
      .eq('status', 'completed')
      .maybeSingle();
    // supabase-js resolves rather than throws, so the error must be read; an
    // unchecked failure would look identical to "this donation does not exist".
    if (error || !data) return null;

    const campaign = Array.isArray(data.campaigns) ? data.campaigns[0] : data.campaigns;
    if (!campaign) return null;

    return {
      amountCents: data.amount_cents as number,
      createdAt: data.created_at as string,
      campaignTitle: campaign.title as string,
      campaignSlug: campaign.slug as string,
      // Derived from the intent id, not invented: the same value appears on the
      // emailed receipt, so support can match them.
      reference: intent.slice(-12).toUpperCase(),
    };
  } catch {
    // A Stripe outage must not turn a successful donation into an error page.
    return null;
  }
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string; campaign?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [t, receipt] = await Promise.all([getTranslator(), resolveReceipt(sp.session_id)]);
  const backHref = receipt ? `/campaigns/${receipt.campaignSlug}` : sp.campaign ? `/campaigns/${sp.campaign}` : '/campaigns';

  return (
    <main id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '56px 24px 72px', textAlign: 'center' }}>
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
      <p style={{ fontSize: 14.5, color: 'var(--t3)', margin: '0 0 30px', lineHeight: 1.55 }}>
        {t('thanks.receipt_sent')}
      </p>

      {receipt && (
        <section
          aria-label={t('thanks.summary')}
          style={{
            textAlign: 'left', padding: 20, marginBottom: 26,
            border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s1)',
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 750, color: 'var(--t1)', margin: '0 0 14px' }}>
            {t('thanks.summary')}
          </h2>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', rowGap: 10, columnGap: 16, fontSize: 14 }}>
            <dt style={{ color: 'var(--t3)' }}>{t('thanks.cause')}</dt>
            <dd style={{ margin: 0, color: 'var(--t1)', fontWeight: 650, textAlign: 'right' }}>{receipt.campaignTitle}</dd>
            <dt style={{ color: 'var(--t3)' }}>{t('donate.amount')}</dt>
            <dd style={{ margin: 0, color: 'var(--t1)', fontWeight: 700, textAlign: 'right' }}>{formatMoneyShort(receipt.amountCents)}</dd>
            <dt style={{ color: 'var(--t3)' }}>{t('thanks.date')}</dt>
            <dd style={{ margin: 0, color: 'var(--t1)', textAlign: 'right' }}>
              {new Date(receipt.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </dd>
            <dt style={{ color: 'var(--t3)' }}>{t('thanks.reference')}</dt>
            <dd style={{ margin: 0, color: 'var(--t2)', textAlign: 'right', fontFamily: 'var(--mono, monospace)', fontSize: 13 }}>
              {receipt.reference}
            </dd>
          </dl>
        </section>
      )}

      <div style={{ display: 'flex', minWidth: 0, gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href={backHref}
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 46, padding: '0 22px',
            borderRadius: 12, background: 'var(--fill-brand)', color: '#fff',
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}
        >
          {t('thanks.back_to_cause')}
        </Link>
        <Link
          href="/causes"
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 46, padding: '0 22px',
            borderRadius: 12, border: '1px solid var(--b2)', background: 'var(--s1)',
            color: 'var(--t1)', fontWeight: 650, fontSize: 15, textDecoration: 'none',
          }}
        >
          {t('causes.browse_all')}
        </Link>
      </div>
    </main>
  );
}
