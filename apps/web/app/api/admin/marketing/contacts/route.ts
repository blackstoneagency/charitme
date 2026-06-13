import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { verifyAdmin } from '../../users/_auth';
import { resolveContact, refreshContactScores, trackEvent } from '../../../../../lib/marketing-engine';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const contactId = sp.get('id');

  // Full contact profile: identity, scores, events, segments, consent
  if (contactId) {
    const [contactRes, eventsRes, segmentsRes, consentRes, identitiesRes] = await Promise.all([
      supabaseAdmin.from('marketing_contacts').select('*').eq('id', contactId).single(),
      supabaseAdmin.from('marketing_events').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('marketing_segment_members').select('segment_id, marketing_segments(name)').eq('contact_id', contactId),
      supabaseAdmin.from('marketing_consent').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('marketing_identities').select('kind, value').eq('contact_id', contactId),
    ]);
    if (!contactRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      contact: contactRes.data,
      events: eventsRes.data ?? [],
      segments: segmentsRes.data ?? [],
      consent: consentRes.data ?? [],
      identities: identitiesRes.data ?? [],
    });
  }

  let query = supabaseAdmin
    .from('marketing_contacts')
    .select('*', { count: 'exact' })
    .order('lead_score', { ascending: false })
    .limit(100);
  const type = sp.get('type');
  const stage = sp.get('stage');
  const search = sp.get('q');
  if (type) query = query.eq('client_type', type);
  if (stage) query = query.eq('lifecycle_stage', stage);
  if (search) query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [], total: count ?? 0 });
}

const LeadSchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(32).optional(),
  clientType: z.enum(['lead', 'donor', 'organizer', 'nonprofit', 'newsletter', 'beneficiary']).default('lead'),
  country: z.string().max(80).optional(),
});

// Admin-created lead
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid lead' }, { status: 400 });

  const contactId = await resolveContact({ ...parsed.data, consentEmail: false, consentSource: 'admin_import' });
  if (!contactId) return NextResponse.json({ error: 'Could not create contact' }, { status: 500 });
  await trackEvent({ contactId, eventType: 'admin_lead_created', metadata: { by: admin.id } });
  await refreshContactScores(contactId);
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'lead_created', entity: 'marketing_contacts', entity_id: contactId,
    detail: { email: parsed.data.email },
  });
  return NextResponse.json({ ok: true, contactId });
}

// Refresh scores for a contact (or sync recent platform users into contacts)
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const id = sp.get('id');

  if (id) {
    await refreshContactScores(id);
    return NextResponse.json({ ok: true });
  }

  // Bulk sync: import platform users (donors/organizers) who aren't contacts yet
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, country')
    .not('email', 'is', null)
    .limit(500);

  let imported = 0;
  for (const p of profiles ?? []) {
    if (!p.email) continue;
    const [first, ...rest] = (p.full_name ?? '').split(' ');
    const contactId = await resolveContact({
      email: p.email,
      userId: p.id,
      firstName: first || undefined,
      lastName: rest.join(' ') || undefined,
      country: p.country ?? undefined,
    });
    if (contactId) {
      await refreshContactScores(contactId);
      imported++;
    }
  }
  await supabaseAdmin.from('marketing_audit_logs').insert({
    actor_id: admin.id, action: 'contacts_synced', entity: 'marketing_contacts', detail: { imported },
  });
  return NextResponse.json({ ok: true, imported });
}
