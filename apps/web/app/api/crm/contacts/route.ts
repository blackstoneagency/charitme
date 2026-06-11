import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { createClient } from '../../../../lib/supabase-server';

const TagsUpdateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().max(120).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20),
  lifetimeValueCents: z.number().int().min(0).optional(),
  lastDonatedAt: z.string().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('donor_crm_contacts')
    .select('id, email, full_name, tags, lifetime_value_cents, last_donated_at')
    .eq('owner_id', user.id)
    .is('nonprofit_id', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = TagsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, fullName, tags, lifetimeValueCents, lastDonatedAt } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const cleanTags = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];

  const { data: existing } = await supabaseAdmin
    .from('donor_crm_contacts')
    .select('id')
    .eq('owner_id', user.id)
    .is('nonprofit_id', null)
    .ilike('email', normalizedEmail)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    tags: cleanTags,
    updated_at: new Date().toISOString(),
  };
  if (fullName) updates.full_name = fullName;
  if (lifetimeValueCents !== undefined) updates.lifetime_value_cents = lifetimeValueCents;
  if (lastDonatedAt) updates.last_donated_at = lastDonatedAt;

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('donor_crm_contacts')
      .update(updates)
      .eq('id', existing.id)
      .select('id, email, full_name, tags, lifetime_value_cents, last_donated_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
  }

  const { data, error } = await supabaseAdmin
    .from('donor_crm_contacts')
    .insert({
      owner_id: user.id,
      email: normalizedEmail,
      full_name: fullName ?? null,
      tags: cleanTags,
      lifetime_value_cents: lifetimeValueCents ?? 0,
      last_donated_at: lastDonatedAt ?? null,
    })
    .select('id, email, full_name, tags, lifetime_value_cents, last_donated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
