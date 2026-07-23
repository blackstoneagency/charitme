import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { verifyAdmin } from '../users/_auth';
import { DEFAULTS, VALID_CATEGORIES, type SettingsCategory } from '../../../../lib/settings-defaults';

function mergeWithDefaults(raw: Record<string, unknown>): Record<SettingsCategory, Record<string, unknown>> {
  const result = {} as Record<SettingsCategory, Record<string, unknown>>;
  for (const cat of VALID_CATEGORIES) {
    const stored = (raw[cat] && typeof raw[cat] === 'object' && !Array.isArray(raw[cat]))
      ? (raw[cat] as Record<string, unknown>)
      : {};
    result[cat] = { ...DEFAULTS[cat], ...stored };
  }
  return result;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();

  if (error && error.code !== '42P01') {
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }

  const raw = (data?.config && typeof data.config === 'object' && !Array.isArray(data.config))
    ? (data.config as Record<string, unknown>)
    : {};
  const merged = mergeWithDefaults(raw);
  return NextResponse.json(merged);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { category, settings } = body as { category: unknown; settings: unknown };

  if (!category || typeof category !== 'string' || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
  }

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return NextResponse.json({ error: 'Invalid settings object' }, { status: 400 });
  }

  const cat = category as SettingsCategory;

  // Fetch current config
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('platform_settings')
    .select('config')
    .eq('id', 1)
    .maybeSingle();

  if (fetchError && fetchError.code !== '42P01') {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const currentConfig = (existing?.config && typeof existing.config === 'object' && !Array.isArray(existing.config))
    ? (existing.config as Record<string, unknown>)
    : {};

  const currentCategorySettings = (currentConfig[cat] && typeof currentConfig[cat] === 'object' && !Array.isArray(currentConfig[cat]))
    ? (currentConfig[cat] as Record<string, unknown>)
    : {};

  const updatedCategorySettings = {
    ...DEFAULTS[cat],
    ...currentCategorySettings,
    ...(settings as Record<string, unknown>),
  };

  const updatedConfig = {
    ...currentConfig,
    [cat]: updatedCategorySettings,
  };

  const { error: upsertError } = await supabaseAdmin
    .from('platform_settings')
    .upsert({
      id: 1,
      config: updatedConfig,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Write audit log entry
  await supabaseAdmin.from('audit_logs').insert({
    action: 'system_settings.updated',
    target_type: 'platform_settings',
    target_id: '1',
    actor_id: admin.id,
    metadata: { category: cat, changes: settings },
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, category: cat, settings: updatedCategorySettings });
}
