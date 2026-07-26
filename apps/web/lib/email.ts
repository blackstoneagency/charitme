import 'server-only';
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey && process.env.NODE_ENV === 'production') {
  console.error('[email] RESEND_API_KEY is not set — all emails will be silently dropped');
}
export const resend = apiKey ? new Resend(apiKey) : null;

const FROM = process.env.EMAIL_FROM ?? 'CharitMe <hello@charitme.com>';
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

function emailWrapper(title: string, body: string, year: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#6c35ff,#4d1ee0);padding:32px 40px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px;">CharitMe</div>
          <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;">${title}</div>
        </td></tr>
        <tr><td style="padding:40px;">${body}</td></tr>
        <tr><td style="background:#f8f9fc;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">© ${year} CharitMe · <a href="${ORIGIN}" style="color:#94a3b8;">charitme.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string, style: 'primary' | 'secondary' = 'primary'): string {
  const bg = style === 'primary' ? '#6c35ff' : '#f5f5f7';
  const color = style === 'primary' ? '#fff' : '#1a1a2e';
  const border = style === 'primary' ? '' : 'border:1px solid #e2e8f0;';
  return `<a href="${href}" style="display:inline-block;background:${bg};color:${color};font-size:13px;font-weight:700;padding:12px 24px;border-radius:9px;text-decoration:none;${border}">${label}</a>`;
}

// ─────────────────────────────────────────────
// Generic marketing email (Admin → Marketing campaigns)
// ─────────────────────────────────────────────
export async function sendMarketingEmail(input: {
  to: string;
  subject: string;
  text: string;
  previewText?: string | null;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };
  const year = new Date().getFullYear();
  const unsubscribeUrl = `${ORIGIN}/api/marketing/unsubscribe?email=${encodeURIComponent(input.to)}`;
  const paragraphs = input.text
    .split(/\n{2,}/)
    .map(p => `<p style="font-size:14px;color:#1a1a2e;line-height:1.7;margin:0 0 16px;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const body = `${paragraphs}
    <p style="font-size:11px;color:#94a3b8;margin:28px 0 0;line-height:1.6;">
      You are receiving this because you interacted with CharitMe.
      <a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a>
    </p>`;
  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: emailWrapper(input.previewText ?? 'CharitMe', body, year),
    text: `${input.text}\n\nUnsubscribe: ${unsubscribeUrl}`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Donation receipt (donor)
// ─────────────────────────────────────────────
/**
 * Returns `{ sent: false }` rather than throwing when email is not configured.
 *
 * This used to return `void` and no-op silently, so every caller "succeeded"
 * whether or not the donor received anything — which let the admin console mark
 * a tax receipt as sent, and write an audit-log entry saying so, with no email
 * behind it. Callers that record a receipt MUST branch on `sent`.
 */
export async function sendReceiptEmail(input: {
  to: string;
  donorName?: string | null;
  campaignTitle: string;
  campaignSlug: string;
  amountFormatted: string;
  donationId?: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const campaignUrl = `${ORIGIN}/campaigns/${input.campaignSlug}`;
  const dashboardUrl = `${ORIGIN}/donor`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      Thank you${input.donorName ? `, ${input.donorName.split(' ')[0]}` : ''}!
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 28px;line-height:1.6;">
      Your donation to <strong style="color:#1a1a2e;">${input.campaignTitle}</strong> has been received.
      This email is your official receipt.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ff;border:2px solid #e0d5ff;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:11px;font-weight:900;color:#8c73cc;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Amount donated</div>
        <div style="font-size:36px;font-weight:900;color:#4d1ee0;">${input.amountFormatted}</div>
        <div style="font-size:13px;color:#8c73cc;margin-top:6px;">to ${input.campaignTitle}</div>
        ${input.donationId ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;font-family:monospace;">Ref: ${input.donationId}</div>` : ''}
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding-right:12px;">${btn(campaignUrl, 'View Campaign')}</td>
        <td>${btn(dashboardUrl, 'My Donations', 'secondary')}</td>
      </tr>
    </table>
    <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0;">
      Payments are processed securely by Stripe. CharitMe never stores your card details.
      Personal fundraiser donations are not tax-deductible unless the campaign is for a verified nonprofit.
    </p>`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `Your CharitMe receipt — ${input.campaignTitle}`,
    html: emailWrapper('Donation Receipt', body, year),
    text: `Thank you for donating ${input.amountFormatted} to "${input.campaignTitle}".\n\nView the campaign: ${campaignUrl}\nYour donations: ${dashboardUrl}\n\n© ${year} CharitMe`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Organizer notification on new donation
// ─────────────────────────────────────────────
export async function sendOrganizerDonationAlert(input: {
  to: string;
  organizerName?: string | null;
  campaignTitle: string;
  campaignSlug: string;
  amountFormatted: string;
  donorDisplayName: string;
  totalRaisedFormatted: string;
  goalFormatted: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const dashboardUrl = `${ORIGIN}/dashboard`;
  const campaignUrl  = `${ORIGIN}/campaigns/${input.campaignSlug}`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      New donation received${input.organizerName ? `, ${input.organizerName.split(' ')[0]}` : ''}!
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
      <strong style="color:#1a1a2e;">${input.donorDisplayName}</strong> just donated to
      <strong style="color:#1a1a2e;">${input.campaignTitle}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:11px;font-weight:900;color:#166534;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Donation amount</div>
        <div style="font-size:32px;font-weight:900;color:#16a34a;">${input.amountFormatted}</div>
        <div style="font-size:13px;color:#4ade80;margin-top:6px;">Total raised: ${input.totalRaisedFormatted} of ${input.goalFormatted} goal</div>
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding-right:12px;">${btn(dashboardUrl, 'View Dashboard')}</td>
        <td>${btn(campaignUrl, 'Campaign Page', 'secondary')}</td>
      </tr>
    </table>
    <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0;">
      Funds will be transferred to your connected bank account per your payout settings.
      Make sure your Stripe account is fully verified to avoid delays.
    </p>`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `New donation: ${input.amountFormatted} for "${input.campaignTitle}"`,
    html: emailWrapper('New Donation', body, year),
    text: `${input.donorDisplayName} just donated ${input.amountFormatted} to "${input.campaignTitle}".\n\nTotal raised: ${input.totalRaisedFormatted} of ${input.goalFormatted} goal.\n\nDashboard: ${dashboardUrl}\n\n© ${year} CharitMe`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Campaign update notification (donors)
// ─────────────────────────────────────────────
export async function sendUpdateNotification(input: {
  to: string;
  donorName?: string | null;
  campaignTitle: string;
  campaignSlug: string;
  updateTitle: string;
  updateBody: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const campaignUrl = `${ORIGIN}/campaigns/${input.campaignSlug}`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      ${input.updateTitle}
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
      An update from <strong style="color:#1a1a2e;">${input.campaignTitle}</strong>:
    </p>
    <div style="background:#f8fafc;border-left:4px solid #6c35ff;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;font-size:14px;color:#334155;line-height:1.7;">
      ${input.updateBody}
    </div>
    ${btn(campaignUrl, 'View Campaign')}`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `Update from ${input.campaignTitle}`,
    html: emailWrapper(`Update: ${input.campaignTitle}`, body, year),
    text: `${input.updateTitle}\n\n${input.updateBody}\n\nView campaign: ${campaignUrl}`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Refund confirmation (donor)
// ─────────────────────────────────────────────
export async function sendRefundEmail(input: {
  to: string;
  donorName?: string | null;
  campaignTitle: string;
  amountFormatted: string;
  refundId?: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const dashboardUrl = `${ORIGIN}/donor`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      Your refund has been processed${input.donorName ? `, ${input.donorName.split(' ')[0]}` : ''}.
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
      Your donation of <strong>${input.amountFormatted}</strong> to <strong style="color:#1a1a2e;">${input.campaignTitle}</strong>
      has been refunded. It may take 5–10 business days to appear on your statement.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:2px solid #fecaca;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:11px;font-weight:900;color:#991b1b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Refund amount</div>
        <div style="font-size:32px;font-weight:900;color:#dc2626;">${input.amountFormatted}</div>
        ${input.refundId ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;font-family:monospace;">Ref: ${input.refundId}</div>` : ''}
      </td></tr>
    </table>
    ${btn(dashboardUrl, 'View Donation History')}
    <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:16px 0 0;">
      If you did not request this refund, please contact us immediately.
    </p>`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `Refund processed — ${input.amountFormatted} from "${input.campaignTitle}"`,
    html: emailWrapper('Refund Processed', body, year),
    text: `Your refund of ${input.amountFormatted} from "${input.campaignTitle}" has been processed.\n\nDonation history: ${dashboardUrl}\n\n© ${year} CharitMe`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Payout notification (organizer)
// ─────────────────────────────────────────────
export async function sendPayoutEmail(input: {
  to: string;
  organizerName?: string | null;
  campaignTitle: string;
  amountFormatted: string;
  status: 'paid' | 'failed' | 'scheduled';
  arrivalDate?: string;
  failureReason?: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const dashboardUrl = `${ORIGIN}/dashboard/payouts`;

  const isSuccess = input.status === 'paid';
  const isPending = input.status === 'scheduled';
  const accentColor = isSuccess ? '#16a34a' : isPending ? '#d97706' : '#dc2626';
  const bgColor = isSuccess ? '#f0fdf4' : isPending ? '#fffbeb' : '#fef2f2';
  const borderColor = isSuccess ? '#bbf7d0' : isPending ? '#fde68a' : '#fecaca';
  const title = isSuccess ? 'Payout Sent!' : isPending ? 'Payout Scheduled' : 'Payout Failed';

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      ${title}${input.organizerName ? `, ${input.organizerName.split(' ')[0]}` : ''}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${bgColor};border:2px solid ${borderColor};border-radius:12px;margin:16px 0 24px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:11px;font-weight:900;color:${accentColor};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
          ${input.campaignTitle}
        </div>
        <div style="font-size:32px;font-weight:900;color:${accentColor};">${input.amountFormatted}</div>
        ${input.arrivalDate ? `<div style="font-size:13px;color:#64748b;margin-top:6px;">Expected: ${input.arrivalDate}</div>` : ''}
        ${input.failureReason ? `<div style="font-size:13px;color:#dc2626;margin-top:6px;">${input.failureReason}</div>` : ''}
      </td></tr>
    </table>
    ${btn(dashboardUrl, 'View Payouts')}`;

  const subjectMap = {
    paid: `Payout of ${input.amountFormatted} is on its way`,
    scheduled: `Payout of ${input.amountFormatted} scheduled`,
    failed: `Action needed: Payout of ${input.amountFormatted} failed`,
  };

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: subjectMap[input.status],
    html: emailWrapper(title, body, year),
    text: `${title}\n\nAmount: ${input.amountFormatted}\nCampaign: ${input.campaignTitle}\n${input.arrivalDate ? `Expected: ${input.arrivalDate}\n` : ''}${input.failureReason ? `Reason: ${input.failureReason}\n` : ''}\nView payouts: ${dashboardUrl}\n\n© ${year} CharitMe`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Beneficiary invite email
// ─────────────────────────────────────────────
export async function sendBeneficiaryInviteEmail(input: {
  to: string;
  organizerName: string;
  campaignTitle: string;
  campaignSlug: string;
  inviteToken: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const acceptUrl = `${ORIGIN}/beneficiary/accept?token=${input.inviteToken}`;
  const campaignUrl = `${ORIGIN}/campaigns/${input.campaignSlug}`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      You've been invited to receive funds!
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
      <strong style="color:#1a1a2e;">${input.organizerName}</strong> has created a fundraiser
      "<strong style="color:#1a1a2e;">${input.campaignTitle}</strong>" and selected you as the beneficiary.
      You'll need to accept this invitation and connect your bank account to receive payouts.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding-right:12px;">${btn(acceptUrl, 'Accept Invitation')}</td>
        <td>${btn(campaignUrl, 'View Campaign', 'secondary')}</td>
      </tr>
    </table>
    <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0;">
      This invitation expires in 7 days. If you did not expect this, you can safely ignore it.
    </p>`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `${input.organizerName} wants you to receive funds from "${input.campaignTitle}"`,
    html: emailWrapper('Beneficiary Invitation', body, year),
    text: `${input.organizerName} has invited you to be the beneficiary of "${input.campaignTitle}".\n\nAccept: ${acceptUrl}\nView campaign: ${campaignUrl}\n\nThis invitation expires in 7 days.\n\n© ${year} CharitMe`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Co-organizer invite email
// ─────────────────────────────────────────────
export async function sendCoOrganizerInviteEmail(input: {
  to: string;
  organizerName: string;
  campaignTitle: string;
  campaignSlug: string;
  role: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const campaignUrl = `${ORIGIN}/campaigns/${input.campaignSlug}`;
  const dashboardUrl = `${ORIGIN}/dashboard`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      You've been invited to co-organize a campaign!
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
      <strong style="color:#1a1a2e;">${input.organizerName}</strong> has added you as
      <strong>${input.role}</strong> on the campaign
      "<strong style="color:#1a1a2e;">${input.campaignTitle}</strong>".
      Log in to your CharitMe account to start contributing.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding-right:12px;">${btn(dashboardUrl, 'Go to Dashboard')}</td>
        <td>${btn(campaignUrl, 'View Campaign', 'secondary')}</td>
      </tr>
    </table>`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `You're now a ${input.role} on "${input.campaignTitle}"`,
    html: emailWrapper('Team Invitation', body, year),
    text: `${input.organizerName} added you as ${input.role} on "${input.campaignTitle}".\n\nDashboard: ${dashboardUrl}\nCampaign: ${campaignUrl}\n\n© ${year} CharitMe`,
  });
  return { sent: true };
}

// ─────────────────────────────────────────────
// Tax receipt (nonprofit donation)
// ─────────────────────────────────────────────
export async function sendTaxReceiptEmail(input: {
  to: string;
  donorName?: string | null;
  nonprofitName: string;
  nonprofitEin: string;
  campaignTitle: string;
  amountFormatted: string;
  receiptNumber: string;
  donationDate: string;
}): Promise<{ sent: boolean }> {
  if (!resend) return { sent: false };

  const year = new Date().getFullYear();
  const dashboardUrl = `${ORIGIN}/donor`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      Official Tax Receipt — Keep for your records
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
      Thank you${input.donorName ? `, ${input.donorName.split(' ')[0]}` : ''}, for your tax-deductible donation to
      <strong style="color:#1a1a2e;">${input.nonprofitName}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ff;border:2px solid #e0d5ff;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:12px;color:#64748b;padding-bottom:8px;">Nonprofit</td>
            <td style="font-size:12px;color:#1a1a2e;font-weight:700;text-align:right;padding-bottom:8px;">${input.nonprofitName}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#64748b;padding-bottom:8px;">EIN</td>
            <td style="font-size:12px;color:#1a1a2e;font-weight:700;text-align:right;font-family:monospace;padding-bottom:8px;">${input.nonprofitEin}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#64748b;padding-bottom:8px;">Campaign</td>
            <td style="font-size:12px;color:#1a1a2e;font-weight:700;text-align:right;padding-bottom:8px;">${input.campaignTitle}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#64748b;padding-bottom:8px;">Date</td>
            <td style="font-size:12px;color:#1a1a2e;font-weight:700;text-align:right;padding-bottom:8px;">${input.donationDate}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#64748b;padding-bottom:8px;">Receipt #</td>
            <td style="font-size:12px;color:#1a1a2e;font-weight:700;text-align:right;font-family:monospace;padding-bottom:8px;">${input.receiptNumber}</td>
          </tr>
          <tr style="border-top:1px solid #e0d5ff;">
            <td style="font-size:16px;font-weight:900;color:#4d1ee0;padding-top:12px;">Amount</td>
            <td style="font-size:16px;font-weight:900;color:#4d1ee0;text-align:right;padding-top:12px;">${input.amountFormatted}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="font-size:12px;color:#64748b;line-height:1.7;margin:0 0 20px;">
      No goods or services were provided in exchange for this contribution. This donation is tax-deductible
      to the extent permitted by law. Please consult your tax advisor.
    </p>
    ${btn(dashboardUrl, 'View Donation History')}`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `Tax Receipt #${input.receiptNumber} — ${input.nonprofitName}`,
    html: emailWrapper('Tax Receipt', body, year),
    text: `Official Tax Receipt\n\nNonprofit: ${input.nonprofitName}\nEIN: ${input.nonprofitEin}\nCampaign: ${input.campaignTitle}\nDate: ${input.donationDate}\nReceipt: ${input.receiptNumber}\nAmount: ${input.amountFormatted}\n\nThis donation is tax-deductible.\n\nView donations: ${dashboardUrl}\n\n© ${year} CharitMe`,
  });
  return { sent: true };
}
