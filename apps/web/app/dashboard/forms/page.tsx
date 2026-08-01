import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import FormsClient, { type DonationForm, type CampaignOption } from './FormsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Donation Forms | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Donation Form Builder (design #148).
//
// `donation_forms` has existed since 20260525002000 and had NO reader and NO
// writer — it appeared in the codebase exactly once, as a table name in
// lib/feature-catalog.ts, where the feature was listed as built. Same "data with
// no reader" family this repo keeps turning up, except here the data never
// arrived either: nothing could create a row.
//
// Scoped by ownership in the query, not just in the UI. The table's READ policy
// is `using (true)` — deliberately, because an embedded form has to resolve for
// an anonymous visitor — so listing "all forms" here would show every
// organizer's forms to every organizer.
// ─────────────────────────────────────────────────────────────────────────────

export default async function DonationFormsPage() {
  const user = await requireUser();

  const [{ data: campaigns }, { data: nonprofits }] = await Promise.all([
    supabaseAdmin
      .from('campaigns')
      .select('id, title, slug')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin.from('nonprofit_profiles').select('id').eq('owner_id', user.id),
  ]);

  const campaignList = (campaigns ?? []) as CampaignOption[];
  const nonprofitIds = (nonprofits ?? []).map((n) => (n as { id: string }).id);
  const campaignIds = campaignList.map((c) => c.id);

  // `null` here means the read FAILED, which the client renders differently from
  // "you have no forms yet". Showing an empty state for a failed query tells
  // someone their forms are gone.
  let forms: DonationForm[] | null = [];
  if (campaignIds.length || nonprofitIds.length) {
    const clauses: string[] = [];
    if (campaignIds.length) clauses.push(`campaign_id.in.(${campaignIds.join(',')})`);
    if (nonprofitIds.length) clauses.push(`nonprofit_id.in.(${nonprofitIds.join(',')})`);

    const { data, error } = await supabaseAdmin
      .from('donation_forms')
      .select(
        'id, nonprofit_id, campaign_id, title, slug, default_amounts_cents, recurring_enabled, currencies, embed_enabled, created_at, updated_at',
      )
      .or(clauses.join(','))
      .order('created_at', { ascending: false })
      .limit(200);

    forms = error ? null : ((data ?? []) as DonationForm[]);
  }

  return (
    <CharitMeShell active="Donation Forms">
      <TopBar
        title="Donation Forms"
        subtitle="Build a custom donation form for your campaign and embed it anywhere."
      />
      <FormsClient initialForms={forms} campaigns={campaignList} />
    </CharitMeShell>
  );
}
