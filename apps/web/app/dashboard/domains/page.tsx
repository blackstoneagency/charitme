import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { TXT_PREFIX } from '../../../lib/custom-domains';
import DomainsClient, { type CustomDomain } from './DomainsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Custom Domain | CharitMe' };

// ─────────────────────────────────────────────────────────────────────────────
// Custom domain (design #150). Table ships in 20260823000000.
//
// I twice declined to build this page, on the grounds that a "Verified ✓" badge
// nothing verifies is worse than no page. That objection was to the FAKE version
// — and it turns out the real one is buildable: ownership verification is a live
// DNS TXT lookup, which Node can do.
//
// So `status` becomes 'verified' only when a resolver actually returns our
// token. There is no manual override and no optimistic path.
//
// ⚠️ What it still cannot do — stated on the page, not buried here: verifying
// ownership does NOT make the domain serve traffic. Routing and TLS issuance
// belong to the hosting provider and nothing in this codebase performs them. The
// honest split is "we can prove you own it; pointing it at us is a step you take
// in your host".
// ─────────────────────────────────────────────────────────────────────────────

export default async function DomainsPage() {
  const user = await requireUser();

  const { data, error } = await supabaseAdmin
    .from('custom_domains')
    .select(
      'id, owner_id, campaign_id, domain, verification_token, status, verified_at, last_checked_at, last_error, created_at',
    )
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const domains: CustomDomain[] | null = error ? null : ((data ?? []) as CustomDomain[]);

  return (
    <CharitMeShell active="Custom Domain">
      <TopBar title="Custom Domain" subtitle="Use your own domain for your campaign pages." />
      <DomainsClient initialDomains={domains} txtPrefix={TXT_PREFIX} />
    </CharitMeShell>
  );
}
