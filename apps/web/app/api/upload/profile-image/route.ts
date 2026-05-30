import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';

const BUCKET = 'avatars';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// POST /api/upload/profile-image
// Body: multipart/form-data { file: File }
// Returns: { url: string; path: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP, or GIF.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Max size is 5MB.' }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Overwrite previous avatar for this user (upsert: true)
  const storagePath = `${user.id}/avatar.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { data, error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, cacheControl: '31536000', upsert: true });

  if (uploadError) {
    const msg = uploadError.message?.toLowerCase().includes('bucket') || uploadError.message?.toLowerCase().includes('not found')
      ? `Storage bucket "${BUCKET}" was not found. Please create it in the Supabase dashboard.`
      : uploadError.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: { publicUrl: url } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(data.path);
  const publicUrl = url;

  // Immediately update the profile avatar_url
  await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({ url: publicUrl, path: storagePath });
}
