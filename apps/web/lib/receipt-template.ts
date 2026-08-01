/**
 * Receipt email templates, as PURE functions.
 *
 * Split out of `lib/email.ts` so that the preview surface (design #137) renders
 * the receipt by calling the same function the sender calls. A preview built
 * from its own markup is worse than no preview: it looks correct on the day the
 * real receipt is broken, and it drifts silently from the thing it claims to
 * show. Same reasoning as the donation widget's live iframe.
 *
 * This module deliberately does NOT import `resend`, `server-only`, or anything
 * that reads the environment at import time — it has to be renderable from a
 * route handler and from a test, with no email provider configured. `origin` is
 * therefore a parameter rather than a module constant.
 *
 * ⚠️ Every interpolated value is escaped. These templates previously
 * concatenated `campaignTitle`, `donorName` and `nonprofitName` straight into
 * HTML. Those are user-controlled: a campaign title is chosen by the fundraiser
 * and lands in an email sent to a donor, which is an HTML injection with a
 * recipient list attached.
 */

export type ReceiptEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** First name only, escaped. Empty input yields an empty string, not "undefined". */
function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first ? escapeHtml(first) : '';
}

function trimSlash(origin: string): string {
  return origin.replace(/\/+$/, '');
}

export function emailWrapper(title: string, body: string, year: number, origin: string): string {
  const safeTitle = escapeHtml(title);
  const home = escapeHtml(trimSlash(origin));
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);">
        <tr><td style="background:linear-gradient(135deg,#6c35ff,#4d1ee0);padding:32px 40px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px;">CharitMe</div>
          <div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px;">${safeTitle}</div>
        </td></tr>
        <tr><td style="padding:40px;">${body}</td></tr>
        <tr><td style="background:#f8f9fc;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">© ${year} CharitMe · <a href="${home}" style="color:#94a3b8;">charitme.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function btn(href: string, label: string, style: 'primary' | 'secondary' = 'primary'): string {
  const bg = style === 'primary' ? '#6c35ff' : '#f5f5f7';
  const color = style === 'primary' ? '#fff' : '#1a1a2e';
  const border = style === 'primary' ? '' : 'border:1px solid #e2e8f0;';
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:${color};font-size:13px;font-weight:700;padding:12px 24px;border-radius:9px;text-decoration:none;${border}">${escapeHtml(label)}</a>`;
}

export type DonationReceiptInput = {
  donorName?: string | null;
  campaignTitle: string;
  campaignSlug: string;
  amountFormatted: string;
  donationId?: string;
};

export function donationReceiptEmail(
  input: DonationReceiptInput,
  origin: string,
  year: number = new Date().getFullYear(),
): ReceiptEmail {
  const base = trimSlash(origin);
  const campaignUrl = `${base}/campaigns/${encodeURIComponent(input.campaignSlug)}`;
  const dashboardUrl = `${base}/donor`;
  const who = firstName(input.donorName);
  const title = escapeHtml(input.campaignTitle);
  const amount = escapeHtml(input.amountFormatted);

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      Thank you${who ? `, ${who}` : ''}!
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 28px;line-height:1.6;">
      Your donation to <strong style="color:#1a1a2e;">${title}</strong> has been received.
      This email is your official receipt.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ff;border:2px solid #e0d5ff;border-radius:12px;margin-bottom:28px;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:11px;font-weight:900;color:#8c73cc;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Amount donated</div>
        <div style="font-size:36px;font-weight:900;color:#4d1ee0;">${amount}</div>
        <div style="font-size:13px;color:#8c73cc;margin-top:6px;">to ${title}</div>
        ${input.donationId ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;font-family:monospace;">Ref: ${escapeHtml(input.donationId)}</div>` : ''}
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

  return {
    subject: `Your CharitMe receipt — ${input.campaignTitle}`,
    html: emailWrapper('Donation Receipt', body, year, base),
    text: `Thank you for donating ${input.amountFormatted} to "${input.campaignTitle}".\n\nView the campaign: ${campaignUrl}\nYour donations: ${dashboardUrl}\n\n© ${year} CharitMe`,
  };
}

export type TaxReceiptInput = {
  donorName?: string | null;
  nonprofitName: string;
  nonprofitEin: string;
  campaignTitle: string;
  amountFormatted: string;
  receiptNumber: string;
  donationDate: string;
};

export function taxReceiptEmail(
  input: TaxReceiptInput,
  origin: string,
  year: number = new Date().getFullYear(),
): ReceiptEmail {
  const base = trimSlash(origin);
  const dashboardUrl = `${base}/donor`;
  const who = firstName(input.donorName);
  const row = (label: string, value: string, mono = false) => `
          <tr>
            <td style="font-size:12px;color:#64748b;padding-bottom:8px;">${escapeHtml(label)}</td>
            <td style="font-size:12px;color:#1a1a2e;font-weight:700;text-align:right;${mono ? 'font-family:monospace;' : ''}padding-bottom:8px;">${escapeHtml(value)}</td>
          </tr>`;

  const body = `
    <p style="font-size:16px;color:#1a1a2e;font-weight:700;margin:0 0 8px;">
      Official Tax Receipt — Keep for your records
    </p>
    <p style="font-size:14px;color:#64748b;margin:0 0 20px;line-height:1.6;">
      Thank you${who ? `, ${who}` : ''}, for your tax-deductible donation to
      <strong style="color:#1a1a2e;">${escapeHtml(input.nonprofitName)}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2ff;border:2px solid #e0d5ff;border-radius:12px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">${row('Nonprofit', input.nonprofitName)}${row('EIN', input.nonprofitEin, true)}${row('Campaign', input.campaignTitle)}${row('Date', input.donationDate)}${row('Receipt #', input.receiptNumber, true)}
          <tr style="border-top:1px solid #e0d5ff;">
            <td style="font-size:16px;font-weight:900;color:#4d1ee0;padding-top:12px;">Amount</td>
            <td style="font-size:16px;font-weight:900;color:#4d1ee0;text-align:right;padding-top:12px;">${escapeHtml(input.amountFormatted)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="font-size:12px;color:#64748b;line-height:1.7;margin:0 0 20px;">
      No goods or services were provided in exchange for this contribution. This donation is tax-deductible
      to the extent permitted by law. Please consult your tax advisor.
    </p>
    ${btn(dashboardUrl, 'View Donation History')}`;

  return {
    subject: `Tax Receipt #${input.receiptNumber} — ${input.nonprofitName}`,
    html: emailWrapper('Tax Receipt', body, year, base),
    text: `Official Tax Receipt\n\nNonprofit: ${input.nonprofitName}\nEIN: ${input.nonprofitEin}\nCampaign: ${input.campaignTitle}\nDate: ${input.donationDate}\nReceipt: ${input.receiptNumber}\nAmount: ${input.amountFormatted}\n\nThis donation is tax-deductible.\n\nView donations: ${dashboardUrl}\n\n© ${year} CharitMe`,
  };
}
