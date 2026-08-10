import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import { isSupportedCurrency } from '@shared/currencies';
import { AiCampaignResponseSchema, fallbackAiCampaign, openai, OPENAI_MODEL, type AiCampaignResponse } from '../../../../lib/openai';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';
import { zodTextFormat } from 'openai/helpers/zod';

const AiCampaignSchema = z.object({
  category: z.enum(CAMPAIGN_CATEGORIES),
  goalAmount: z.number().int().min(100).max(1_000_000_000),
  currency: z.string().trim().transform((value) => value.toUpperCase())
    .refine(isSupportedCurrency, 'Unsupported currency.').default('USD'),
  beneficiary: z.string().min(1).max(120),
  notes: z.string().min(10).max(4000),
  tone: z.string().max(40).optional(),
  sourceLinks: z.array(z.string().url().max(2000).refine(
    (value) => value.startsWith('https://') || value.startsWith('http://'),
    'Only http and https links are supported.',
  )).max(5).optional(),
  sourceDocuments: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!(await checkRateLimitDurable(`ai:${user.id}`, 12, 60_000))) {
    return NextResponse.json({ error: 'Too many AI requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AiCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid AI request', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }

  let output: AiCampaignResponse = fallbackAiCampaign(parsed.data);
  let modelUsed = 'fallback';

  if (openai) {
    try {
      const response = await openai.responses.create({
        model: OPENAI_MODEL,
        text: { format: zodTextFormat(AiCampaignResponseSchema, 'campaign_draft') },
        input: [
          {
            role: 'system',
            content: 'You are CharitMe AI Campaign Copilot. Write authentic, non-manipulative fundraising content and never invent facts. Money is integer minor units in the supplied currency. Return strict JSON with: title, summary, story, category, suggestedGoalCents, useOfFunds[{label,amountCents}], socialCaption, longPost, sms, email, donorFaq[{question,answer}], donationTiers[{amountCents,label}], milestones[{title,description,targetCents}], seoTitle, seoDescription, coverImageGuidance, missingTrustSignals, qualityScore.',
          },
          { role: 'user', content: JSON.stringify(parsed.data) },
        ],
      });
      const text = response.output_text;
      const candidate: unknown = JSON.parse(text);
      const validated = AiCampaignResponseSchema.safeParse(candidate);
      if (validated.success) {
        output = validated.data;
        modelUsed = OPENAI_MODEL;
      }
    } catch {
      output = fallbackAiCampaign(parsed.data);
    }
  }

  const { error: generationError } = await supabaseAdmin.from('ai_generations').insert({
    user_id: user.id,
    generation_type: 'campaign_copilot',
    prompt: parsed.data,
    output,
    model: modelUsed,
  });
  if (generationError) {
    return NextResponse.json(
      { error: 'The generated draft could not be saved. Please try again.', code: 'GENERATION_SAVE_FAILED' },
      { status: 503 },
    );
  }

  return NextResponse.json(output);
}
