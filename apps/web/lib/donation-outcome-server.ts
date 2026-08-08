import 'server-only';
import { cache } from 'react';
import { stripe } from './stripe';
import { supabaseAdmin } from './supabase';
import { parseSessionId, paymentMethodLabel, type DonationOutcome } from './donation-outcome-core';

/**
 * Resolve a Stripe checkout session into the donation behind it.
 *
 * This is the single loader for steps 9–12 (success, receipt, share, return).
 * All four screens describe ONE payment, so they must not each reconstruct it —
 * four readers of the same fact is how a receipt ends up disagreeing with the
 * confirmation screen shown thirty seconds earlier.
 *
 * ## Authorization
 *
 * Possession of the `cs_...` id. Stripe hands it to exactly one party — the
 * browser that completed the checkout, via `success_url` — and it appears in no
 * listing, feed or export of ours. That is what lets these pages work for a
 * signed-out donor, which most donors are.
 *
 * It is a bearer credential, so it is treated like one: `robots: noindex` on
 * every page that takes it, `Referrer-Policy` already set globally, and
 * `parseSessionId` rejects anything that is not a Stripe id before it reaches a
 * query.
 *
 * ## Why the database first, and Stripe only as a fallback
 *
 * The donation row is the record of truth — it is what the campaign total, the
 * donor wall and the emailed receipt were all built from. Reading Stripe first
 * would show the donor a number that our own database might not yet agree with.
 *
 * Stripe is consulted in exactly two cases, and each is a real one:
 *
 *  1. **The webhook has not landed yet.** Stripe redirects the browser the
 *     instant payment succeeds; `checkout.session.completed` arrives moments
 *     later. Without this fallback the donor's first sight of a successful
 *     donation is a page with no amount on it. The session is retrieved
 *     server-side and its `payment_status` checked, so the figure is verified —
 *     it is not read off the URL. Status comes back `pending`, and the screens
 *     that need a donation id (the receipt) stay hidden rather than linking
 *     somewhere that 404s.
 *
 *  2. **The payment method.** `donations` records no card brand or last4, and
 *     it should not — that is Stripe's to hold. The receipt line "Visa ••••
 *     4242" is expanded from the payment intent's charge on the receipt screen
 *     only, so the other three screens make no Stripe call at all.
 *
 * Every failure path returns `null`, and callers render a confirmation without a
 * summary. That is deliberate and predates this file: the old success URL
 * carried `?amount=` in the query string, so the page was rendering an
 * official-looking receipt for a number the visitor could edit. Verified data or
 * no data.
 */

type DonationRow = {
  id: string;
  donor_id: string | null;
  amount_cents: number;
  tip_cents: number | null;
  processing_fee_cents: number | null;
  currency: string | null;
  created_at: string;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  campaign_id: string;
  campaigns: { id: string; title: string; slug: string } | null;
};

const DONATION_COLUMNS =
  'id, donor_id, amount_cents, tip_cents, processing_fee_cents, currency, created_at, payment_method, stripe_payment_intent_id, campaign_id, campaigns:campaign_id(id, title, slug)';

/** `42703` = this database has not applied the column-drift migration yet. */
const MISSING_COLUMN = '42703';

async function donationBySession(sessionId: string): Promise<DonationRow | null | 'no-column'> {
  const { data, error } = await supabaseAdmin
    .from('donations')
    .select(DONATION_COLUMNS)
    .eq('stripe_checkout_session_id', sessionId)
    .eq('status', 'completed')
    .maybeSingle();
  if (error) return error.code === MISSING_COLUMN ? 'no-column' : null;
  return (data as unknown as DonationRow) ?? null;
}

/** Fallback for when PostgREST returns the row without its embed. */
async function campaignById(id: string): Promise<{ id: string; title: string; slug: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; title: string; slug: string };
}

async function donationByIntent(intentId: string): Promise<DonationRow | null> {
  const { data, error } = await supabaseAdmin
    .from('donations')
    .select(DONATION_COLUMNS)
    .eq('stripe_payment_intent_id', intentId)
    .eq('status', 'completed')
    .maybeSingle();
  if (error) return null;
  return (data as unknown as DonationRow) ?? null;
}

/**
 * `getDonationOutcome(sessionId, { withPaymentMethod })`
 *
 * Memoized per request with React `cache()`, so a layout and its page reading
 * the same session cost one lookup rather than two.
 */
export const getDonationOutcome = cache(async function getDonationOutcome(
  rawSessionId: string | undefined,
  options: { withPaymentMethod?: boolean } = {},
): Promise<DonationOutcome | null> {
  const sessionId = parseSessionId(rawSessionId);
  if (!sessionId) return null;

  try {
    let row = await donationBySession(sessionId);

    // Session lookup is impossible on a database missing the column. Fall through
    // to Stripe, which can name the payment intent the donation was recorded under.
    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>> | null = null;
    const needStripe = row === 'no-column' || row === null || options.withPaymentMethod === true;

    if (needStripe && process.env.STRIPE_SECRET_KEY?.trim()) {
      session = await stripe.checkout.sessions
        .retrieve(sessionId, { expand: ['payment_intent.latest_charge'] })
        .catch(() => null);
    }

    if (row === 'no-column' || row === null) {
      const intent = typeof session?.payment_intent === 'string'
        ? session.payment_intent
        : session?.payment_intent?.id ?? null;
      row = intent ? await donationByIntent(intent) : null;
    }

    // ⚠️ The embed is not guaranteed. PostgREST resolves `campaigns:campaign_id(…)`
    // from its schema cache, and a cache that has not reloaded after a migration
    // returns the row with the embed simply ABSENT rather than erroring — which
    // is why this schema ships a `reload_postgrest_schema_cache` RPC at all.
    // Treating a missing embed as "no donation" would blank a real, paid receipt
    // over a transient cache state, so the campaign is fetched directly instead.
    // (`row` is narrowed to DonationRow | null by the branch above.)
    const campaign = row ? row.campaigns ?? await campaignById(row.campaign_id) : null;

    if (row && campaign) {
      const [donor, receipt, tax] = await Promise.all([
        row.donor_id
          ? supabaseAdmin.from('profiles').select('full_name, email').eq('id', row.donor_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from('donation_receipts')
          .select('receipt_number, donor_name, donor_email')
          .eq('donation_id', row.id)
          .maybeSingle(),
        supabaseAdmin
          .from('tax_receipts')
          .select('receipt_number, nonprofit_name, nonprofit_ein, amount_cents')
          .eq('donation_id', row.id)
          .maybeSingle(),
      ]);

      const profile = donor.data as { full_name?: string | null; email?: string | null } | null;
      const rec = receipt.data as { receipt_number?: string | null; donor_name?: string | null; donor_email?: string | null } | null;
      const taxRow = tax.data as {
        receipt_number?: string | null;
        nonprofit_name?: string | null;
        nonprofit_ein?: string | null;
        amount_cents?: number | null;
      } | null;
      const taxDeductible = Boolean(taxRow?.nonprofit_name && taxRow.nonprofit_ein);
      const taxReceiptAmountCents = taxDeductible && Number.isInteger(taxRow?.amount_cents) && (taxRow?.amount_cents ?? -1) >= 0
        ? taxRow?.amount_cents ?? null
        : null;

      return {
        status: 'settled',
        donationId: row.id,
        amountCents: row.amount_cents,
        tipCents: row.tip_cents ?? 0,
        processingFeeCents: row.processing_fee_cents ?? 0,
        currency: row.currency ?? 'usd',
        createdAt: row.created_at,
        transactionId: row.stripe_payment_intent_id,
        donorName: profile?.full_name ?? rec?.donor_name ?? session?.customer_details?.name ?? null,
        donorEmail: profile?.email ?? rec?.donor_email ?? session?.customer_details?.email ?? null,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug,
        paymentMethodLabel: methodFromSession(session) ?? fallbackMethod(row.payment_method),
        receiptNumber: taxRow?.receipt_number ?? rec?.receipt_number ?? null,
        taxDeductible,
        taxReceiptAmountCents,
        nonprofitName: taxDeductible ? taxRow!.nonprofit_name! : null,
        nonprofitEin: taxDeductible ? taxRow!.nonprofit_ein! : null,
      };
    }

    // ── Nothing recorded yet. Only a genuinely PAID session may be shown. ─────
    if (!session || session.payment_status !== 'paid') return null;

    const campaignId = session.metadata?.campaignId;
    if (!campaignId) return null;
    const pendingCampaign = await campaignById(campaignId);
    if (!pendingCampaign) return null;

    // From metadata, which OUR server wrote when it created the session — not
    // from the URL, and not from anything the browser can reach.
    const amountCents = Number(session.metadata?.donationAmountCents ?? '');
    if (!Number.isFinite(amountCents) || amountCents <= 0) return null;

    return {
      status: 'pending',
      donationId: null,
      amountCents,
      tipCents: Number(session.metadata?.tipCents ?? '0') || 0,
      processingFeeCents: Number(session.metadata?.processingFeeCents ?? '0') || 0,
      currency: session.metadata?.currency ?? session.currency ?? 'usd',
      createdAt: session.created ? new Date(session.created * 1000).toISOString() : null,
      transactionId: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
      donorName: session.customer_details?.name ?? null,
      donorEmail: session.customer_details?.email ?? null,
      campaignId: pendingCampaign.id,
      campaignTitle: pendingCampaign.title,
      campaignSlug: pendingCampaign.slug,
      paymentMethodLabel: methodFromSession(session),
      receiptNumber: null,
      // A tax receipt is issued by the webhook. Before that there is no basis
      // for the claim, and "tax deductible" is not a claim to make optimistically.
      taxDeductible: false,
      taxReceiptAmountCents: null,
      nonprofitName: null,
      nonprofitEin: null,
    };
  } catch {
    // supabaseAdmin throws on property access when its env is unset, and a
    // Stripe outage must not turn a successful donation into an error page.
    return null;
  }
});

/** Card brand and last4 from the expanded charge, when it was expanded. */
function methodFromSession(session: unknown): string | null {
  const s = session as {
    payment_intent?: { latest_charge?: { payment_method_details?: Record<string, unknown> } | string } | string | null;
  } | null;
  const intent = s?.payment_intent;
  if (!intent || typeof intent === 'string') return null;
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string') return null;

  const details = charge.payment_method_details as
    | { type?: string; card?: { brand?: string; last4?: string; wallet?: { type?: string } | null } }
    | undefined;
  if (!details) return null;

  return paymentMethodLabel({
    type: details.type ?? null,
    brand: details.card?.brand ?? null,
    last4: details.card?.last4 ?? null,
    wallet: details.card?.wallet?.type ?? null,
  });
}

/** `donations.payment_method` is a free-text column; only known values are shown. */
function fallbackMethod(value: string | null): string | null {
  return paymentMethodLabel(value ? { type: value } : null);
}
