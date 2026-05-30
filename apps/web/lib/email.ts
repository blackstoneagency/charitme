import 'server-only';
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

const FROM = process.env.EMAIL_FROM ?? 'CharitMe <hello@charitme.com>';
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.charitme.com';

// ─────────────────────────────────────────────
// Donation receipt
// ─────────────────────────────────────────────
export async function sendReceiptEmail(input: {
  to: string;
  donorName?: string | null;
  campaignTitle: string;
  campaignSlug: string;
  amountFormatted: string;
  donationId?: string;
}): Promise<void> {
  if (!resend) return;

  const year = new Date().getFullYear();
  const campaignUrl = `${ORIGIN}/campaigns/${input.campaignSlug}`;
  const dashboardUrl = `${ORIGIN}/dashboard/donations`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Donation Receipt</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#6c35ff,#4d1ee0);padding:32px 40px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px;">CharitMe</div>
          <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;">Donation Receipt</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
            Thank you${input.donorName ? `, ${input.donorName.split(' ')[0]}` : ''}! 💚
          </p>
          <p style="font-size:14px;color:#64748b;margin:0 0 28px;line-height:1.6;">
            Your donation to <strong style="color:#1a1a2e;">${input.campaignTitle}</strong> has been received.
            This email is your receipt.
          </p>

          <!-- Amount box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ff;border:2px solid #e0d5ff;border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:11px;font-weight:900;color:#8c73cc;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Amount donated</div>
              <div style="font-size:36px;font-weight:900;color:#4d1ee0;">${input.amountFormatted}</div>
              <div style="font-size:13px;color:#8c73cc;margin-top:6px;">to ${input.campaignTitle}</div>
            </td></tr>
          </table>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td style="padding-right:12px;">
                <a href="${campaignUrl}" style="display:inline-block;background:#6c35ff;color:#fff;font-size:13px;font-weight:700;padding:12px 24px;border-radius:9px;text-decoration:none;">View Campaign</a>
              </td>
              <td>
                <a href="${dashboardUrl}" style="display:inline-block;background:#f5f5f7;color:#1a1a2e;font-size:13px;font-weight:700;padding:12px 24px;border-radius:9px;text-decoration:none;border:1px solid #e2e8f0;">My Donations</a>
              </td>
            </tr>
          </table>

          <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0;">
            Payments are processed securely by Stripe. CharitMe never stores your card details.
            If you have questions, reply to this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8f9fc;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">© ${year} CharitMe · <a href="${ORIGIN}" style="color:#94a3b8;">charitme.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `Your CharitMe receipt — ${input.campaignTitle}`,
    html,
    text: `Thank you for donating ${input.amountFormatted} to "${input.campaignTitle}".\n\nView the campaign: ${campaignUrl}\nYour donations: ${dashboardUrl}\n\n© ${year} CharitMe`,
  });
}

// ─────────────────────────────────────────────
// Campaign update notification
// ─────────────────────────────────────────────
export async function sendUpdateNotification(input: {
  to: string;
  donorName?: string | null;
  campaignTitle: string;
  campaignSlug: string;
  updateTitle: string;
  updateBody: string;
}): Promise<void> {
  if (!resend) return;

  const campaignUrl = `${ORIGIN}/campaigns/${input.campaignSlug}`;

  await resend.emails.send({
    from: FROM,
    to: input.to,
    subject: `Update from ${input.campaignTitle}`,
    text: `${input.updateTitle}\n\n${input.updateBody}\n\nView campaign: ${campaignUrl}`,
  });
}
