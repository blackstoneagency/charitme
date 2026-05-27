import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';

const BUCKET = 'campaign-images';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);

// ─────────────────────────────────────────────
// POST /api/upload/campaign-image
// Body: multipart/form-data { file: File }
// Returns: { url: string; path: string }
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  // Validate
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Use JPG, PNG, GIF, WebP, or AVIF.' },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Max size is 10MB.' }, { status: 400 });
  }

  // Build storage path scoped to the user
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `campaigns/${user.id}/${safeName}`;

  // Convert File → Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { data, error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return NextResponse.json({ url: publicUrl, path: data.path });
}

// ─────────────────────────────────────────────
// DELETE /api/upload/campaign-image
// Body: { path: string }
// ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || typeof (body as { path?: unknown }).path !== 'string') {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  const path = (body as { path: string }).path;

  // Security: path must belong to this user
  if (!path.startsWith(`campaigns/${user.id}/`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
