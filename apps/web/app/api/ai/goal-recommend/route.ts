import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { openai, OPENAI_MODEL } from '../../../../lib/openai';
import { checkRateLimit } from '../../../../lib/rate-limit';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const Schema = z.object({
  category: z.string().min(2).max(80),
  beneficiary: z.string().min(2).max(200),
  notes: z.string().max(2000).optional(),
  location: z.string().max(120).optional(),
});

// Goal ranges by category (in cents) for fallback
const CATEGORY_RANGES: Record<string, { min: number; typical: number; max: number; label: string }> = {
  'Medical':           { min: 500000, typical: 2000000, max: 10000000, label: 'medical expenses' },
  'Memorial/Funeral':  { min: 500000, typical: 1500000, max:  5000000, label: 'memorial costs' },
  'Emergency':         { min: 100000, typical:  500000, max:  2000000, label: 'emergency needs' },
  'Disaster Relief':   { min: 100000, typical: 1000000, max: 10000000, label: 'disaster recovery' },
  'Education':         { min: 500000, typical: 1500000, max: 20000000, label: 'education costs' },
  'Animal/Pet':        { min:  50000, typical:  300000, max:  2000000, label: 'veterinary care' },
  'Community':         { min: 100000, typical:  500000, max:  5000000, label: 'community projects' },
  'Nonprofit':         { min: 500000, typical: 2500000, max: 50000000, label: 'nonprofit initiatives' },
  'Sports/Teams':      { min:  50000, typical:  300000, max:  2000000, label: 'athletic goals' },
  'Other':             { min:  50000, typical:  500000, max:  5000000, label: 'your goal' },
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 });

  const ip = request.headers.get('x-forwarded-for') ?? 'local';
  if (!checkRateLimit(`ai-goal:${ip}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { category, beneficiary, notes, location } = parsed.data;

  // Get median goal for this category from our own platform data
  const { data: platformData } = await supabaseAdmin
    .from('campaigns')
    .select('goal_amount, raised_amount')
    .eq('category', category)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20);

  const typicalGoal = platformData && platformData.length > 0
    ? Math.round(
        (platformData as { goal_amount: number }[])
          .reduce((sum, c) => sum + c.goal_amount, 0) / platformData.length
      )
    : null;

  // Use AI for a personalized recommendation when available
  if (openai) {
    try {
      const platformContext = typicalGoal
        ? `Typical goal for ${category} campaigns on this platform: $${(typicalGoal / 100).toLocaleString()}.`
        : '';

      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: `You are a fundraising expert. Recommend a realistic fundraising goal amount in USD cents (integer only, no commas). Consider the specific circumstances, category benchmarks, and platform data. Return JSON: { "goal_cents": number, "reasoning": string (2-3 sentences explaining the recommendation), "range_min": number, "range_max": number }`,
          },
          {
            role: 'user',
            content: `Category: ${category}\nBeneficiary: ${beneficiary}\nNotes: ${notes ?? 'Not provided'}\nLocation: ${location ?? 'Not specified'}\n${platformContext}\n\nRecommend a goal in USD cents.`,
          },
        ],
      });

      const text = response.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()) as {
        goal_cents: number;
        reasoning: string;
        range_min: number;
        range_max: number;
      };

      return NextResponse.json({
        goal_cents: Math.round(parsed.goal_cents),
        reasoning: parsed.reasoning,
        range_min: Math.round(parsed.range_min),
        range_max: Math.round(parsed.range_max),
        platform_typical: typicalGoal,
        source: 'ai',
      });
    } catch {
      // Fall through to static fallback
    }
  }

  // Static fallback based on category ranges
  const range = CATEGORY_RANGES[category] ?? CATEGORY_RANGES['Other']!;
  const goal = typicalGoal ?? range.typical;

  return NextResponse.json({
    goal_cents: goal,
    reasoning: `Based on similar ${category.toLowerCase()} campaigns and typical ${range.label}, we recommend a goal in the $${(range.min / 100).toLocaleString()}–$${(range.max / 100).toLocaleString()} range. Starting with $${(goal / 100).toLocaleString()} gives you a credible, achievable target.`,
    range_min: range.min,
    range_max: range.max,
    platform_typical: typicalGoal,
    source: 'static',
  });
}
