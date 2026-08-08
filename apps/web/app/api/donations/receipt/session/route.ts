import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getDonationOutcome } from '../../../../../lib/donation-outcome-server';
import { parseSessionId, totalChargedCents, receiptReference } from '../../../../../lib/donation-outcome-core';
import { donationReceiptEmail, taxReceiptEmail } from '../../../../../lib/receipt-template';
import { checkRateLimitDurable } from '../../../../../lib/rate-limit-durable';
import { formatCents } from '../../../../../lib/stripe';

/**
 * The donor's own receipt, downloadable straight after checkout.
 *
 * ## Why this exists next to `GET /api/donations/receipt`
 *
 * That route authorizes by SESSION COOKIE, which is right for "show me a past
 * donation from my dashboard" and useless here: most donors are signed out, and
 * a guest donation creates no account at all. Without this route the artwork's
 * "Download Receipt" button either 401s for the majority of donors or has to be
 * hidden from them — a receipt they were told was theirs and cannot take.
 *
 * Authorization is possession of the Stripe checkout session id, the same
 * bearer credential the whole post-payment flow runs on. It is worth being
 * precise about what that does and does not permit: it identifies ONE payment,
 * it is issued by Stripe to the party who made it, and it grants nothing beyond
 * reading that payment's own receipt. It cannot list donations, cannot reach a
 * different donation, and cannot resend anything — this route is read-only, and
 * the resend path deliberately stays cookie-authenticated.
 *
 * The document is produced by the same `receipt-template` functions the email
 * sender uses, so what downloads here cannot differ from what was emailed.
 */

export const dynamic = 'force-dynamic';

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = parseSessionId(request.nextUrl.searchParams.get('session_id') ?? undefined);
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  // Unauthenticated by design, so it is bounded by IP. The session id is
  // high-entropy and unguessable; this stops it being used as an oracle to
  // probe for valid ones at volume.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!(await checkRateLimitDurable(`receipt-session:${ip}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const outcome = await getDonationOutcome(sessionId);
  if (!outcome) {
    return NextResponse.json({ error: 'Receipt not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  if (!outcome.donationId) {
    // Paid, but the webhook has not written the row yet. 409 rather than 404:
    // the receipt is not missing, it is not finished, and retrying works.
    return NextResponse.json(
      { error: 'The receipt is still being prepared', code: 'RECEIPT_PENDING' },
      { status: 409, headers: { 'Retry-After': '5' } },
    );
  }

  const receiptAmountCents = outcome.taxDeductible
    ? outcome.taxReceiptAmountCents ?? outcome.amountCents
    : totalChargedCents(outcome);
  const amountFormatted = formatCents(receiptAmountCents, outcome.currency);
  const mail = outcome.taxDeductible && outcome.nonprofitName && outcome.nonprofitEin
    ? taxReceiptEmail({
      donorName: outcome.donorName,
      nonprofitName: outcome.nonprofitName,
      nonprofitEin: outcome.nonprofitEin,
      campaignTitle: outcome.campaignTitle,
      amountFormatted,
      receiptNumber: outcome.receiptNumber ?? receiptReference(outcome.transactionId) ?? outcome.donationId,
      donationDate: outcome.createdAt
        ? new Date(outcome.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '',
    }, ORIGIN)
    : donationReceiptEmail({
      donorName: outcome.donorName,
      campaignTitle: outcome.campaignTitle,
      campaignSlug: outcome.campaignSlug,
      amountFormatted,
      donationId: outcome.donationId,
    }, ORIGIN);

  const filename = `charitme-receipt-${(outcome.receiptNumber ?? outcome.donationId).replace(/[^A-Za-z0-9-]/g, '')}.html`;

  return new NextResponse(mail.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // `attachment` so the button saves a file rather than navigating the donor
      // away from the flow they are still in.
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
