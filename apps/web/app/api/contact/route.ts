import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { resend } from '../../../lib/email';
import { checkRateLimit } from '../../../lib/rate-limit';

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  subject: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10).max(4000),
});

function contactRecipients(): string[] {
  const configured = process.env.CONTACT_EMAIL ?? process.env.ADMIN_EMAILS ?? 'hello@kindfund.com';
  return configured.split(',').map((email) => email.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!checkRateLimit(`contact:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many contact requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please complete all fields before sending.', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (resend) {
    const { name, email, subject, message } = parsed.data;
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'KindFund <hello@kindfund.com>',
      to: contactRecipients(),
      replyTo: email,
      subject: `KindFund contact: ${subject}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        '',
        message,
      ].join('\n'),
    });
  }

  return NextResponse.json({ ok: true });
}
