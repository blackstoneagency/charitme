import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { resend } from '../../../lib/email';
import { checkRateLimit } from '../../../lib/rate-limit';
import { supabaseAdmin } from '../../../lib/supabase';

const ContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  subject: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10).max(4000),
});

function contactRecipients(): string[] {
  const configured = process.env.CONTACT_EMAIL ?? process.env.ADMIN_EMAILS ?? 'hello@CharitMe.com';
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

  const { name, email, subject, message } = parsed.data;
  const ipHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
    .then((buffer) => Buffer.from(buffer).toString('hex'));
  const { error } = await supabaseAdmin.from('contact_messages').insert({
    name,
    email,
    subject,
    message,
    ip_hash: ipHash,
  });

  if (error) {
    return NextResponse.json({ error: 'Unable to save your message right now.', code: 'CONTACT_SAVE_FAILED' }, { status: 500 });
  }

  if (resend) {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'CharitMe <hello@CharitMe.com>',
      to: contactRecipients(),
      replyTo: email,
      subject: `CharitMe contact: ${subject}`,
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
