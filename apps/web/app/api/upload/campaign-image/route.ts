import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { supabaseAdmin } from '../../../../lib/supabase';
import { canManageCampaign } from '../../../../lib/auth';
import { parseCampaignMediaPath } from '../../../../lib/campaign-media';

const BUCKET = 'campaign-media';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);
const ALLOWED_SLOT_TYPES = new Set(['cover', 'gallery', 'video']);

function isBucketMissing(msg: string): boolean {
  return msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('not found');
}

// POST /api/upload/campaign-image
// Body: multipart/form-data { file, campaignId?, type? }
// type: 'cover' | 'gallery' | 'video' — defaults to 'cover'
// Returns: { url, path }
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
    return NextResponse.json(
      { error: 'Invalid file type. Use JPG, PNG, GIF, WebP, or AVIF.' },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large. Max size is 5MB.', code: 'FILE_TOO_LARGE' }, { status: 400 });
  }

  // Optional: campaignId scopes the path under the campaign folder
  // Optional: type is one of cover | gallery | video
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const ext      = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
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
    console.error('Campaign media upload failed');
    return NextResponse.json(
      { error: isBucketMissing(uploadError.message) ? 'Campaign media storage is unavailable.' : 'Campaign media could not be uploaded.', code: 'MEDIA_UPLOAD_FAILED' },
      { status: 500 },
    );
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  let warning: string | undefined;
  if (campaignId) {
    const { error: mediaError } = await supabaseAdmin.from('campaign_media').insert({
      campaign_id: campaignId,
      uploader_id: user.id,
      media_type: 'image',
      storage_path: data.path,
      public_url: publicUrl,
    });
    if (mediaError) {
      console.error('Campaign media metadata save failed', mediaError.code);
      warning = 'The file uploaded, but its campaign media metadata could not be stored.';
    }
  }

  return NextResponse.json(warning ? { url: publicUrl, path: data.path, warning } : { url: publicUrl, path: data.path });
}

// DELETE /api/upload/campaign-image
// Body: { path: string }
export async function DELETE(req: NextRequest) {
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

  const path = (body as { path: string }).path.trim();
  const parsedPath = parseCampaignMediaPath(path);
  if (!parsedPath) {
    return NextResponse.json({ error: 'Invalid campaign media path' }, { status: 400 });
  }

  // Security: path must belong to this user or a campaign they own
  if (parsedPath.ownerId !== user.id) {
    // Also allow paths scoped to a campaign the user owns
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', parsedPath.ownerId)
      .maybeSingle();
    if (!campaign) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (removeError) {
    console.error('Campaign media removal failed');
    return NextResponse.json({ error: isBucketMissing(removeError.message) ? 'Campaign media storage is unavailable.' : 'Campaign media could not be removed.', code: 'MEDIA_REMOVE_FAILED' }, { status: 500 });
  }

  const { error: metadataError } = await supabaseAdmin
    .from('campaign_media')
    .delete()
    .eq('storage_path', path);
  if (metadataError) {
    console.error('Campaign media metadata removal failed', metadataError.code);
    return NextResponse.json({ ok: true, warning: 'The file was removed, but its campaign media metadata could not be removed.' });
  }

  return NextResponse.json({ ok: true });
}
