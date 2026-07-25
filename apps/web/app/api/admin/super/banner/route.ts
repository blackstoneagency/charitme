import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { guardSuperAdmin, logSuperAdminAction } from '../../../../../lib/super-admin';
import {
  normalizeBannerSettings,
  BANNER_FONT_OPTIONS,
  BANNER_FONT_WEIGHTS,
  DEFAULT_BANNER_SETTINGS,
} from '../../../../../lib/banner-settings';

export const dynamic = 'force-dynamic';

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const FONT_VALUES = BANNER_FONT_OPTIONS.map((f) => f.value) as [string, ...string[]];
const WEIGHTS = BANNER_FONT_WEIGHTS as readonly number[];

// Every appearance value lands in an inline style, so the schema is strict:
// colours must be hex, the font family must come from the allow-list, and sizes
// are bounded. Anything else is a 400 — never a best-effort coercion.
const SettingsSchema = z.object({
  enabled:            z.boolean(),
  background_color:   z.string().regex(HEX, 'Must be a hex colour like #12b76a'),
  text_color:         z.string().regex(HEX, 'Must be a hex colour like #ffffff'),
  link_color:         z.string().regex(HEX, 'Must be a hex colour like #ffffff'),
  font_family:        z.enum(FONT_VALUES),
  font_size_px:       z.number().int().min(10).max(28),
  title_font_size_px: z.number().int().min(10).max(28),
  font_weight:        z.number().int().refine((n) => WEIGHTS.includes(n), 'Unsupported font weight'),
  title_font_weight:  z.number().int().refine((n) => WEIGHTS.includes(n), 'Unsupported font weight'),
  text_align:         z.enum(['left', 'center', 'right']),
  letter_spacing_em:  z.number().min(-0.05).max(0.5),
  uppercase:          z.boolean(),
  padding_y_px:       z.number().int().min(0).max(40),
  dismissible:        z.boolean(),
  use_level_colors:   z.boolean(),
}).partial();

/** GET — current banner settings (super admin only). */
export async function GET() {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const { data } = await supabaseAdmin
    .from('banner_settings')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();

  return NextResponse.json({
    settings: normalizeBannerSettings(data as Record<string, unknown> | null),
    fonts: BANNER_FONT_OPTIONS,
    weights: BANNER_FONT_WEIGHTS,
    defaults: DEFAULT_BANNER_SETTINGS,
  });
}

/** PUT — update banner settings (super admin only, audited). */
export async function PUT(request: NextRequest) {
  const guard = await guardSuperAdmin();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid banner settings', code: 'INVALID_INPUT', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('banner_settings')
    .upsert({ id: 'global', ...parsed.data, updated_by: guard.user.id }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not save banner settings', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  // Drop the cached copy so the change is live immediately rather than after the
  // 60s ISR window.
  revalidateTag('banner-settings');

  await logSuperAdminAction(guard.user.id, 'banner_settings_updated', 'banner_settings', 'global', parsed.data);

  return NextResponse.json({ settings: normalizeBannerSettings(data as Record<string, unknown>) });
}
