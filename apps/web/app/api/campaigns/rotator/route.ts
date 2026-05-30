import 'server-only';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';

export const revalidate = 60; // ISR: refresh every 60s

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select(
      'slug,title,category,cover_image_url,goal_amount,raised_amount,backer_count,trust_status,campaign_health_score,deadline,featured,profiles:user_id(full_name)',
    )
    .eq('status', 'active')
    .not('cover_image_url', 'is', null)
    .neq('cover_image_url', '')
    .order('featured', { ascending: false })
    .order('raised_amount', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Raw = {
    slug: string; title: string; category: string | null;
    cover_image_url: string | null; featured: boolean | null;
    goal_amount: number; raised_amount: number; backer_count: number;
    trust_status: string | null; campaign_health_score: number | null;
    deadline: string | null;
    profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
  };

  const campaigns = ((data ?? []) as Raw[])
    .filter(c => c.cover_image_url?.startsWith('http'))
    .map(c => ({
      slug:                  c.slug,
      title:                 c.title,
      category:              c.category,
      cover_image_url:       c.cover_image_url!,
      goal_amount:           c.goal_amount,
      raised_amount:         c.raised_amount,
      backer_count:          c.backer_count,
      trust_status:          c.trust_status,
      campaign_health_score: c.campaign_health_score,
      deadline:              c.deadline,
      featured:              c.featured ?? false,
      organizer_name:        Array.isArray(c.profiles)
        ? (c.profiles[0]?.full_name ?? null)
        : ((c.profiles as { full_name: string | null } | null)?.full_name ?? null),
    }));

  return NextResponse.json({ campaigns });
}
