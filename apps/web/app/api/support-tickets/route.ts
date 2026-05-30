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

  const { name, email, subject, message, category, priority, campaignId } = parsed.data;

  // Get authenticated user if present
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Try to insert into support_tickets table if it exists
  let ticketId: string | null = null;
  try {
    const { data: ticket } = await supabaseAdmin
      .from('support_tickets')
      .insert({
        submitter_id: user?.id ?? null,
        name,
        email,
        subject,
        message,
        category,
        priority,
        campaign_id: campaignId ?? null,
        status: 'open',
      })
      .select('id')
      .single();
    ticketId = (ticket as { id: string } | null)?.id ?? null;
  } catch {
    // Table may not exist yet — continue to send email regardless
  }

  // Always send email notification to support team
  if (resend) {
    const ticketRef = ticketId ? `Ticket #${ticketId.slice(0, 8).toUpperCase()}` : 'No ticket ID';
    try {
      await resend.emails.send({
        from: FROM,
        to: SUPPORT_EMAIL,
        replyTo: email,
        subject: `[${priority.toUpperCase()}] ${category}: ${subject}`,
        text: `New support request (${ticketRef})\n\nFrom: ${name} <${email}>\nCategory: ${category}\nPriority: ${priority}\n${campaignId ? `Campaign: ${campaignId}\n` : ''}\n---\n${message}`,
      });
      // Auto-acknowledge to the submitter
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `We received your message — ${ticketRef}`,
        text: `Hi ${name},\n\nThank you for reaching out. We've received your message and will respond within 24–48 hours (${priority === 'urgent' ? '4 hours for urgent issues' : 'typically within 1 business day'}).\n\nYour reference: ${ticketRef}\nSubject: ${subject}\n\nCharitMe Support`,
      });
    } catch { /* email failure is non-fatal */ }
  }

  return NextResponse.json({ ok: true, ticketId }, { status: 201 });
}

// GET /api/support-tickets — list tickets for authenticated user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data } = await supabaseAdmin
      .from('support_tickets')
      .select('id, subject, category, status, priority, created_at')
      .eq('submitter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ tickets: data ?? [] });
  } catch {
    return NextResponse.json({ tickets: [] });
  }
}
