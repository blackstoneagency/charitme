import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { fallbackAiCampaign, openai, OPENAI_MODEL, type AiCampaignResponse } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const AiCampaignSchema = z.object({
  category: z.string().min(2).max(80),
  goalAmount: z.number().int().min(100).max(10_000_000),
  beneficiary: z.string().min(1).max(120),
  notes: z.string().min(10).max(4000),
  tone: z.string().max(40).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  // Durable, cross-instance limit for this expensive OpenAI-backed endpoint.
  if (!(await checkRateLimitDurable(`ai:${ip}`, 12, 60_000))) {
    return NextResponse.json({ error: 'Too many AI requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AiCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid AI request', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }

  let output: AiCampaignResponse = fallbackAiCampaign(parsed.data);

  if (openai) {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: 'You are CharitMe AI Campaign Copilot. Write authentic, non-manipulative fundraising content. Return strict JSON matching: title, story, socialCaption, longPost, sms, email, donorFaq array, donationTiers array of amount/label, missingTrustSignals array, qualityScore number.',
        },
        { role: 'user', content: JSON.stringify(parsed.data) },
      ],
    });

    const text = response.output_text;
    try {
      output = JSON.parse(text) as AiCampaignResponse;
    } catch {
      output = fallbackAiCampaign(parsed.data);
    }
  }

  await supabaseAdmin.from('ai_generations').insert({
    user_id: user.id,
    generation_type: 'campaign_copilot',
    prompt: parsed.data,
    output,
    model: openai ? OPENAI_MODEL : 'fallback',
  });

  return NextResponse.json(output);
}
