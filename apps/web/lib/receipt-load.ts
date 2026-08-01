import 'server-only';
import { supabaseAdmin } from './supabase';
import { isAdmin } from './roles';
import { formatCents } from './stripe';
import { canAccessDonationReceipt, normalizeReceiptEmail } from './tax-receipt-access';
import { donationReceiptEmail, taxReceiptEmail, type ReceiptEmail } from './receipt-template';

/**
 * Load a donation, authorize the caller, and render its receipt.
 *
 * This exists so the RESEND route and the PREVIEW route share one authorization
 * path. Two implementations of "may this person see this receipt" is how a
 * preview surface ends up leaking donor names, amounts and email addresses: the
 * resend endpoint gets the careful check, the read-only one looks harmless and
 * gets a lighter one, and nothing about the resulting page looks wrong.
 *
 * The render also runs through the same `receipt-template` functions the email
 * sender uses, so a preview cannot show a receipt that differs from the one
 * delivered.
 */

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

export type ReceiptLoadFailure = { ok: false; status: number; error: string; code: string };

export type ReceiptLoadSuccess = {
  ok: true;
  mail: ReceiptEmail;
  /** Where a resend would go. `null` when there is no address on file. */
  donorEmail: string | null;
  donorName: string | null;
  isTaxReceipt: boolean;
  donation: {
    id: string;
    donorId: string | null;
    campaignId: string;
    amountCents: number;
    tipCents: number;
    processingFeeCents: number;
    currency: string;
    createdAt: string;
    campaignTitle: string;
    campaignSlug: string;
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
  };
  existingReceipt: {
    id: string;
    receiptNumber: string | null;
    receiptType: string | null;
  } | null;
  taxReceipt: { receiptNumber: string; nonprofitName: string; nonprofitEin: string } | null;
};

export type ReceiptLoadResult = ReceiptLoadSuccess | ReceiptLoadFailure;

type DonationRow = {
  id: string;
  donor_id: string | null;
  amount_cents: number;
  tip_cents: number | null;
  processing_fee_cents: number | null;
  currency: string | null;
  campaign_id: string;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  campaigns: { title: string; slug: string } | null;
};

const fail = (status: number, error: string, code: string): ReceiptLoadFailure =>
  ({ ok: false, status, error, code });

export async function loadReceiptForUser(
  donationId: string,
  user: { id: string; email?: string | null },
): Promise<ReceiptLoadResult> {
  const { data: donation, error: donationError } = await supabaseAdmin
    .from('donations')
    .select('id, donor_id, amount_cents, tip_cents, processing_fee_cents, currency, campaign_id, status, created_at, stripe_payment_intent_id, stripe_checkout_session_id, campaigns:campaign_id(title, slug)')
    .eq('id', donationId)
    .maybeSingle();
  if (donationError) return fail(503, 'Receipt data unavailable', 'RECEIPT_DATA_UNAVAILABLE');
  if (!donation) return fail(404, 'Donation not found', 'NOT_FOUND');
  const don = donation as unknown as DonationRow;

  const { data: receipt, error: receiptLoadError } = await supabaseAdmin
    .from('donation_receipts')
    .select('id, donor_id, donor_email, donor_name, receipt_number, receipt_type')
    .eq('donation_id', don.id)
    .limit(1)
    .maybeSingle();
  if (receiptLoadError) return fail(503, 'Receipt data unavailable', 'RECEIPT_DATA_UNAVAILABLE');

  const ownsReceipt = canAccessDonationReceipt({
    userId: user.id,
    userEmail: user.email,
    donationDonorId: don.donor_id,
    receiptDonorId: receipt?.donor_id ?? null,
    receiptEmail: receipt?.donor_email ?? null,
  });
  if (!ownsReceipt && !(await isAdmin(user.id, user.email))) {
    return fail(403, 'Forbidden', 'FORBIDDEN');
  }

  if (don.status !== 'completed') return fail(400, 'Donation not completed', 'DONATION_NOT_COMPLETED');
  if (!don.campaigns) return fail(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND');

  const { data: profile } = don.donor_id
    ? await supabaseAdmin.from('profiles').select('full_name, email').eq('id', don.donor_id).maybeSingle()
    : { data: null };

  const donorEmail = normalizeReceiptEmail(
    (profile as { email?: string | null } | null)?.email
      ?? receipt?.donor_email
      ?? (ownsReceipt ? user.email : null),
  );
  const donorName = (profile as { full_name?: string | null } | null)?.full_name
    ?? receipt?.donor_name
    ?? null;

  const { data: tax, error: taxError } = await supabaseAdmin
    .from('tax_receipts')
    .select('receipt_number, nonprofit_name, nonprofit_ein, campaign_title')
    .eq('donation_id', don.id)
    .maybeSingle();
  if (taxError) return fail(503, 'Receipt data unavailable', 'RECEIPT_DATA_UNAVAILABLE');

  const amountFormatted = formatCents(don.amount_cents, don.currency ?? 'usd');
  const isTaxReceipt = Boolean(tax?.nonprofit_name && tax.nonprofit_ein);

  const mail = isTaxReceipt && tax
    ? taxReceiptEmail({
      donorName,
      nonprofitName: tax.nonprofit_name as string,
      nonprofitEin: tax.nonprofit_ein as string,
      campaignTitle: (tax.campaign_title as string | null) ?? don.campaigns.title,
      amountFormatted,
      receiptNumber: tax.receipt_number as string,
      donationDate: new Date(don.created_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      }),
    }, ORIGIN)
    : donationReceiptEmail({
      donorName,
      campaignTitle: don.campaigns.title,
      campaignSlug: don.campaigns.slug,
      amountFormatted,
      donationId: don.id,
    }, ORIGIN);

  return {
    ok: true,
    mail,
    donorEmail,
    donorName,
    isTaxReceipt,
    donation: {
      id: don.id,
      donorId: don.donor_id,
      campaignId: don.campaign_id,
      amountCents: don.amount_cents,
      tipCents: don.tip_cents ?? 0,
      processingFeeCents: don.processing_fee_cents ?? 0,
      currency: don.currency ?? 'usd',
      createdAt: don.created_at,
      campaignTitle: don.campaigns.title,
      campaignSlug: don.campaigns.slug,
      stripePaymentIntentId: don.stripe_payment_intent_id,
      stripeCheckoutSessionId: don.stripe_checkout_session_id,
    },
    existingReceipt: receipt
      ? {
        id: receipt.id as string,
        receiptNumber: (receipt.receipt_number as string | null) ?? null,
        receiptType: (receipt.receipt_type as string | null) ?? null,
      }
      : null,
    taxReceipt: isTaxReceipt && tax
      ? {
        receiptNumber: tax.receipt_number as string,
        nonprofitName: tax.nonprofit_name as string,
        nonprofitEin: tax.nonprofit_ein as string,
      }
      : null,
  };
}
