import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { SUPPORTED_CURRENCY_CODES } from '@shared/currencies';
import { SUPPORTED_LOCALE_CODES } from '../../../lib/i18n';
import { supabaseAdmin } from '../../../lib/supabase';
import { createClient } from '../../../lib/supabase-server';

const CURRENCY_CODES_LOWER = new Set(SUPPORTED_CURRENCY_CODES.map(c => c.toLowerCase()));
const LOCALE_CODES = new Set(SUPPORTED_LOCALE_CODES);

const SettingsSchema = z.object({
  // Profile
  full_name: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  // Organization
  org_name: z.string().max(120).optional().nullable(),
  org_website: z.string().url().optional().nullable().or(z.literal('')),
  org_tagline: z.string().max(200).optional().nullable(),
  // Locale
  timezone: z.string().max(60).optional(),
  currency: z.string().refine(c => CURRENCY_CODES_LOWER.has(c.toLowerCase()), 'Unsupported currency').optional(),
  language: z.string().refine(l => LOCALE_CODES.has(l.toLowerCase()), 'Unsupported language').optional(),
  date_format: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  time_format: z.enum(['12h', '24h']).optional(),
  // Preferences
  show_public_profile: z.boolean().optional(),
  campaign_recommendations: z.boolean().optional(),
  // Notifications
  notification_email: z.boolean().optional(),
  notification_marketing: z.boolean().optional(),
});

type SettingsRow = z.infer<typeof SettingsSchema>;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(
        'full_name,bio,avatar_url,plan,stripe_customer_id,' +
        'org_name,org_website,org_tagline,' +
        'timezone,currency,language,date_format,time_format,' +
        'show_public_profile,campaign_recommendations,' +
        'notification_email,notification_marketing'
      )
      .eq('id', user.id)
      .single();

    if (error) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    return NextResponse.json({ settings: data, email: user.email });
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
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const d = parsed.data as SettingsRow;
    const fields: (keyof SettingsRow)[] = [
      'full_name', 'bio', 'avatar_url',
      'org_name', 'org_website', 'org_tagline',
      'timezone', 'currency', 'language', 'date_format', 'time_format',
      'show_public_profile', 'campaign_recommendations',
      'notification_email', 'notification_marketing',
    ];
    for (const key of fields) {
      if (d[key] !== undefined) updates[key] = d[key];
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select(
        'full_name,bio,avatar_url,plan,' +
        'org_name,org_website,org_tagline,' +
        'timezone,currency,language,date_format,time_format,' +
        'show_public_profile,campaign_recommendations,' +
        'notification_email,notification_marketing'
      )
      .single();

    if (error) return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    return NextResponse.json({ settings: data });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
