import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { canManageCampaign } from '../../../../lib/auth';
import { isSafeStoragePath } from '../../../../lib/storage-path';
import { checkRateLimitDurable } from '../../../../lib/rate-limit-durable';

const BUCKET = 'campaign-media';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_TYPE = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);
const ALLOWED_TYPES = new Set(EXTENSION_BY_TYPE.keys());
const ALLOWED_SLOT_TYPES = new Set(['cover', 'gallery']);

function isBucketMissing(msg: string): boolean {
  return msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('not found');
}

// POST /api/upload/campaign-image
// Body: multipart/form-data { file, campaignId?, type? }
// type: 'cover' | 'gallery' - defaults to 'cover'
// Returns: { url, path }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!(await checkRateLimitDurable(`campaign-image:${user.id}`, 30, 60_000))) {
    return NextResponse.json({ error: 'Too many uploads', code: 'RATE_LIMITED' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data', code: 'INVALID_FORM_DATA' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field', code: 'MISSING_FILE' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Use JPG, PNG, GIF, WebP, or AVIF.', code: 'INVALID_FILE_TYPE' },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Max size is 5MB.', code: 'FILE_TOO_LARGE' }, { status: 400 });
  }

  // Optional: campaignId scopes the path under the campaign folder
  // Optional: type is one of cover | gallery
  const rawCampaignId = formData.get('campaignId');
  const rawType       = formData.get('type');
  const campaignId    = typeof rawCampaignId === 'string' && rawCampaignId.trim() ? rawCampaignId.trim() : null;
  const slotType      = typeof rawType === 'string' && ALLOWED_SLOT_TYPES.has(rawType) ? rawType : 'cover';

  // Authorization: if the upload is scoped to a campaign, the caller must be
  // able to manage it. Otherwise anyone could write media into another user's
  // campaign folder. No campaignId → the file is scoped to the user's own folder.
  if (campaignId) {
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .maybeSingle();
    if (!campaign || !(await canManageCampaign(user, campaign.user_id))) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }
  }

  const ext      = EXTENSION_BY_TYPE.get(file.type) ?? 'jpg';
  const safeName = `${crypto.randomUUID()}.${ext}`;

  // Path: campaigns/{campaignId}/{type}/{file}  OR  campaigns/{userId}/{type}/{file}
  const folder      = campaignId ? `campaigns/${campaignId}` : `campaigns/${user.id}`;
  const storagePath = `${folder}/${slotType}/${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer      = new Uint8Array(arrayBuffer);

  const { data, error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error(`[upload] ${isBucketMissing(uploadError.message) ? 'bucket unavailable' : 'storage write failed'}`);
    return NextResponse.json({ error: 'Image could not be uploaded.', code: 'UPLOAD_FAILED' }, { status: 500 });
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return NextResponse.json({ url: publicUrl, path: data.path }, { status: 201 });
}

// DELETE /api/upload/campaign-image
// Body: { path: string }
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 });
  }
  if (!(await checkRateLimitDurable(`campaign-image-delete:${user.id}`, 60, 60_000))) {
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
  }

  if (typeof body !== 'object' || body === null || typeof (body as { path?: unknown }).path !== 'string') {
    return NextResponse.json({ error: 'Missing path', code: 'MISSING_PATH' }, { status: 400 });
  }

  const path = (body as { path: string }).path;

  // Defence in depth: reject traversal / absolute / encoded segments before the
  // ownership check. Supabase Storage currently treats keys as opaque strings, so
  // `campaigns/<me>/../../covers/x.webp` does NOT resolve out of the caller's
  // folder today — but the ownership check below is a `startsWith` on that prefix,
  // so the moment key normalisation changes (or this code is reused against a
  // store that does normalise) it would authorise deleting anything in the bucket.
  // Validate the shape explicitly rather than depending on that behaviour.
  if (!isSafeStoragePath(path)) {
    return NextResponse.json({ error: 'Invalid path', code: 'INVALID_PATH' }, { status: 400 });
  }

  // Security: path must belong to this user or a campaign they own
  if (!path.startsWith(`campaigns/${user.id}/`)) {
    // Also allow paths scoped to a campaign the user owns
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', user.id)
      .filter('id', 'eq', path.split('/')[1] ?? '')
      .maybeSingle();
    if (!campaign) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }
  }

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (removeError) {
    console.error(`[upload] ${isBucketMissing(removeError.message) ? 'bucket unavailable' : 'storage delete failed'}`);
    return NextResponse.json({ error: 'Image could not be removed.', code: 'DELETE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
