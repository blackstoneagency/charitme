import { boundedQuery } from '../../../lib/query-timeout';
import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import NewCustomersClient, { type LeadRow } from './_components/NewCustomersClient';

export const dynamic = 'force-dynamic';

export default async function NewCustomersPage() {
  await requireAdmin();

  // The marketing-link migration (20260613000000) adds marketing_contact_id.
  // On environments where it hasn't been applied yet, selecting that column
  // hard-errors ("column ... does not exist"), which would crash the whole
  // page. Select it when present, but transparently fall back to a column set
  // without it so the page keeps working until the migration is applied through
  // the release workflow.
  const BASE_COLUMNS = 'id, business_name, entity_type, state, filing_date, filing_status, registered_agent, owner_name, industry, address, website, email, phone, enrichment_notes, enrichment_model, enriched_at, lead_score, lead_grade, status, alerted, source, created_at';

  const primary = await boundedQuery(() => supabaseAdmin
    .from('business_leads')
    .select(`${BASE_COLUMNS}, marketing_contact_id`)
    .order('lead_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500));

  let data = primary.data as LeadRow[] | null;
  let error = primary.error;
  let marketingLinkAvailable = true;

  if (error && /column .*marketing_contact_id.* does not exist/i.test(error.message)) {
    marketingLinkAvailable = false;
    const fallback = await boundedQuery(() => supabaseAdmin
      .from('business_leads')
      .select(BASE_COLUMNS)
      .order('lead_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500));
    data = fallback.data as LeadRow[] | null;
    error = fallback.error;
  }

  // Surface a missing-migration / DB error clearly instead of a blank page.
  if (error) {
    const needsMigration = /relation .*business_leads.* does not exist/i.test(error.message);
    return (
      <CharitMeShell active="New Customers" mode="admin">
        <TopBar title="New Customers" subtitle="AI-sourced business leads from new LLC filings." actions={<></>} />
        <div style={{ padding: '32px' }}>
          <div style={{ padding: '24px 28px', background: 'var(--tint-rose)', border: '1.5px solid #fecdd3', borderRadius: 14, maxWidth: 720 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--red-text)', margin: '0 0 10px' }}>
              {needsMigration ? '⚠ Migration not applied yet' : '❌ Database error'}
            </h2>
            <p style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--red-text)', margin: '0 0 14px', lineHeight: 1.7 }}>
              {error.message}
            </p>
            {needsMigration && (
              <div style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1.8 }}>
                Run <code>supabase/migrations/20260612100000_business_leads.sql</code> in the Supabase SQL editor,
                then reload this page.
              </div>
            )}
          </div>
        </div>
      </CharitMeShell>
    );
  }

  const leads = (data ?? []) as LeadRow[];

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === 'new').length,
    enriched: leads.filter((l) => l.enriched_at).length,
    hot: leads.filter((l) => l.lead_score >= 60).length,
    contacted: leads.filter((l) => ['contacted', 'qualified', 'converted'].includes(l.status)).length,
    synced: marketingLinkAvailable ? leads.filter((l) => l.marketing_contact_id).length : 0,
  };

  return (
    <CharitMeShell active="New Customers" mode="admin">
      <TopBar
        title="New Customers"
        subtitle="Newly filed businesses, AI-enriched with contact info and scored for outreach."
        actions={<></>}
      />
      <NewCustomersClient initialLeads={leads} stats={stats} />
    </CharitMeShell>
  );
}
