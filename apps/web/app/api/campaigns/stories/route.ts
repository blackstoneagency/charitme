import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStoryCampaigns } from '../../../../lib/home-data';

const StoryQuerySchema = z.object({
  storyCategory: z.enum(['', 'individuals', 'nonprofits', 'community', 'emergency']).optional().default(''),
  storyQ: z.string().max(80).optional().default(''),
  storySort: z.enum(['latest', 'raised', 'donors']).optional().default('latest'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const parsed = StoryQuerySchema.safeParse({
    storyCategory: searchParams.get('storyCategory') ?? '',
    storyQ: searchParams.get('storyQ') ?? '',
    storySort: searchParams.get('storySort') ?? 'latest',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid campaign story filters', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const campaigns = await getStoryCampaigns(parsed.data);
    return NextResponse.json({ campaigns });
  } catch {
    return NextResponse.json(
      { error: 'Campaign stories could not be loaded.', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
}
