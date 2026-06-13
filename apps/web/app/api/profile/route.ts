import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';

const UpdateProfileSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional().nullable(),
  notification_email: z.boolean().optional(),
  notification_updates: z.boolean().optional(),
  notification_marketing: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, bio, avatar_url, roles, created_at, notification_email, notification_updates, notification_marketing')
      .eq('id', user.id)
      .single();

    // Resolve display name / avatar the same way the public header (AppShell)
    // does — falling back to the auth session's user_metadata — so the signed-in
    // identity is consistent across the homepage and the admin/dashboard shell,
    // even when a profiles row is missing or has no full_name yet.
    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
    const resolvedName = data?.full_name ?? meta.full_name ?? meta.name ?? null;
    const resolvedAvatar = data?.avatar_url ?? meta.avatar_url ?? meta.picture ?? null;

    if (error && !data) {
      // No profiles row yet — still return the auth-derived identity so the
      // header renders the real name instead of a generic "Account".
      const fallbackProfile = {
        id: user.id, full_name: resolvedName, bio: null, avatar_url: resolvedAvatar,
        roles: [], created_at: null,
        notification_email: true, notification_updates: true, notification_marketing: true,
      };
      return NextResponse.json({ profile: fallbackProfile, email: user.email });
    }
    if (error) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    return NextResponse.json({ profile: { ...data, full_name: resolvedName, avatar_url: resolvedAvatar }, email: user.email });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.full_name !== undefined) updates.full_name = parsed.data.full_name;
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
    if (parsed.data.avatar_url !== undefined) updates.avatar_url = parsed.data.avatar_url;
    if (parsed.data.notification_email !== undefined) updates.notification_email = parsed.data.notification_email;
    if (parsed.data.notification_updates !== undefined) updates.notification_updates = parsed.data.notification_updates;
    if (parsed.data.notification_marketing !== undefined) updates.notification_marketing = parsed.data.notification_marketing;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('id, full_name, bio, avatar_url, roles, notification_email, notification_updates, notification_marketing')
      .single();

    if (error) return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
