import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';

const Schema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).min(1).max(20),
  campaignId: z.string().uuid().optional(),
});

const SYSTEM_PROMPT = `You are CharitMe's AI Fundraising Coach — a warm, expert advisor who helps organizers raise more money effectively and ethically.

Your expertise:
- Campaign storytelling and emotional connection
- Donor psychology and giving behavior
- Social media strategy for fundraising
- Email outreach and donor communication
- Trust-building and transparency
- Momentum tactics and urgency without manipulation
- Thank-you and donor retention strategies
- Analytics interpretation and next actions

Your style:
- Practical and specific — always give actionable advice
- Warm and encouraging — fundraising is emotional work
- Honest — never suggest manipulative tactics
- Brief — give clear answers, not lectures
- Data-driven — reference what actually works

When given campaign context, personalize advice to that specific campaign.
When asked to generate content (emails, posts, updates), write it immediately — don't ask clarifying questions first.
Always keep CharitMe's 0% platform fee advantage top of mind when discussing fee positioning.`;

// POST /api/ai/coach
// Returns a streaming text response from the AI coach.
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  if (!(await checkRateLimitDurable(`ai-coach:${ip}`, 20, 60_000))) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }

  // Auth — coach is available to signed-in users only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to use the AI Coach.' }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { messages, campaignId } = parsed.data;

  // Optionally fetch campaign context to personalise advice
  let campaignContext = '';
  if (campaignId) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('title, category, goal_amount, raised_amount, backer_count, description, status, deadline')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campaign) {
      const pct = campaign.goal_amount > 0
        ? Math.round((campaign.raised_amount / campaign.goal_amount) * 100)
        : 0;
      campaignContext = `\n\nActive campaign context:
- Title: "${campaign.title}"
- Category: ${campaign.category}
- Goal: $${(campaign.goal_amount / 100).toLocaleString()}
- Raised: $${(campaign.raised_amount / 100).toLocaleString()} (${pct}%)
- Donors: ${campaign.backer_count}
- Status: ${campaign.status}
- Deadline: ${campaign.deadline ?? 'none'}`;
    }
  }

  // Fall back to a helpful non-AI response when OpenAI is not configured
  if (!openai) {
    const lastMessage = messages[messages.length - 1]?.content ?? '';
    const fallback = generateFallbackResponse(lastMessage);
    return new NextResponse(fallback, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Stream the response
  const stream = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    stream: true,
    max_tokens: 600,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT + campaignContext },
      ...messages,
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache',
    },
  });
}

function generateFallbackResponse(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('share') || q.includes('social')) {
    return 'The best time to share is within the first 24 hours of launch — that momentum signals trust to new visitors. Share to Facebook, WhatsApp groups, and email first. Personal stories outperform generic asks by 3x. Use the share buttons on your campaign page for pre-written messages.';
  }
  if (q.includes('donor') || q.includes('donation')) {
    return 'Campaigns that post updates within 48 hours of launch raise 30% more. Send a personal thank-you within 24 hours of each donation. Your first 10 donors are usually friends/family — turn them into sharers, not just donors.';
  }
  if (q.includes('story') || q.includes('write')) {
    return 'A strong fundraising story answers: Who is affected? What happened? Why now? How will the money help? What changes when you succeed? Keep it under 400 words for the best engagement. Use the AI story writer in the campaign editor.';
  }
  if (q.includes('goal') || q.includes('amount')) {
    return 'Set your goal based on specific, itemized needs rather than a round number. "Surgery: $8,400 + recovery: $2,600 = $11,000" is more credible than "$10,000." Add 15% buffer for unexpected costs. You can always raise more than your goal.';
  }
  return 'Great question! Connect your OpenAI API key in the environment settings to get personalized AI coaching. In the meantime, visit the Help Center for fundraising guides, or check your AI Growth Plan for specific next steps.';
}
