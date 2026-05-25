import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { calculateTrustScore, getTrustSignals, getTrustStatus } from '../../../lib/ai-platform';

const TrustSchema = z.object({
  description: z.string().optional(),
  tagline: z.string().optional(),
  cover_image_url: z.string().nullable().optional(),
  identity_verified: z.boolean().optional(),
  beneficiary_verified: z.boolean().optional(),
  stripe_onboarded: z.boolean().optional(),
  evidence_count: z.number().int().optional(),
  risk_flag_count: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = TrustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid trust score request', code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }
  const score = calculateTrustScore(parsed.data);
  return NextResponse.json({ score, status: getTrustStatus(score), signals: getTrustSignals(parsed.data) });
}
