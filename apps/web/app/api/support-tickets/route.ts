import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';
import { resend } from '../../../lib/email';

const FROM = process.env.EMAIL_FROM ?? 'CharitMe <hello@charitme.com>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'hello@charitme.com';

const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  subject: z.string().trim().min(4).max(200),
  message: z.string().trim().min(10).max(5000),
  category: z.enum(['general', 'billing', 'campaign', 'donation', 'payout', 'fraud', 'technical', 'other']).default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  campaignId: z.string().uuid().optional(),
  donationId: z.string().uuid().optional(),
});

// POST /api/support-tickets
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { name, email, subject, message, priority, campaignId, donationId } = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Insert into support_cases (canonical table name from schema)
  const { data: ticket } = await supabaseAdmin
    .from('support_cases')
    .insert({
      submitter_id: user?.id ?? null,
      campaign_id: campaignId ?? null,
      donation_id: donationId ?? null,
      subject,
      body: message,
      priority,
      status: 'open',
    })
    .select('id')
    .single();

  const ticketId = (ticket as { id: string } | null)?.id ?? null;
  const ticketRef = ticketId ? `Ticket #${ticketId.slice(0, 8).toUpperCase()}` : 'New request';

  if (resend) {
    await Promise.allSettled([
      resend.emails.send({
        from: FROM,
        to: SUPPORT_EMAIL,
        replyTo: email,
        subject: `[${priority.toUpperCase()}] ${subject}`,
        text: `New support request (${ticketRef})\n\nFrom: ${name} <${email}>\nPriority: ${priority}\n${campaignId ? `Campaign: ${campaignId}\n` : ''}${donationId ? `Donation: ${donationId}\n` : ''}\n---\n${message}`,
      }),
      resend.emails.send({
        from: FROM,
        to: email,
        subject: `We received your message — ${ticketRef}`,
        text: `Hi ${name},\n\nThank you for reaching out. We've received your message and will respond within 24–48 hours.\n\nYour reference: ${ticketRef}\nSubject: ${subject}\n\nCharitMe Support`,
      }),
    ]);
  }

  return NextResponse.json({ ok: true, ticketId }, { status: 201 });
}

// GET /api/support-tickets — list cases for authenticated user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabaseAdmin
    .from('support_cases')
    .select('id, subject, status, priority, created_at')
    .eq('submitter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ tickets: data ?? [] });
}
