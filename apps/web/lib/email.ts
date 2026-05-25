import 'server-only';
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export async function sendReceiptEmail(input: {
  to: string;
  campaignTitle: string;
  amountFormatted: string;
}): Promise<void> {
  if (!resend) return;

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'GiveRise <hello@giverise.example>',
    to: input.to,
    subject: `Your GiveRise receipt for ${input.campaignTitle}`,
    text: `Thank you for donating ${input.amountFormatted} to ${input.campaignTitle}. Your receipt and impact updates will be available in your donor dashboard.`,
  });
}
