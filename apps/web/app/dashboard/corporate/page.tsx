import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import CorporateClient, { type CorporateAccountView, type RuleView, type MemberView } from './CorporateClient';

export const dynamic = 'force-dynamic';

export default async function CorporatePage() {
  const user = await requireUser();

  const { data: account } = await supabaseAdmin
    .from('corporate_accounts')
    .select('id, name, email_domain, default_match_ratio, annual_cap_cents, active')
    .eq('admin_user_id', user.id)
    .maybeSingle();

  let rules: RuleView[] = [];
  let members: MemberView[] = [];
  if (account) {
    const [{ data: ruleRows }, { data: memberRows }] = await Promise.all([
      supabaseAdmin.from('matching_gift_rules').select('id, category, ratio, per_gift_cap_cents, annual_cap_cents, active').eq('corporate_id', account.id).order('created_at', { ascending: true }),
      supabaseAdmin.from('corporate_members').select('id, email, role, status').eq('corporate_id', account.id).neq('status', 'removed').order('created_at', { ascending: true }),
    ]);
    rules = (ruleRows ?? []).map((r) => ({
      id: r.id, category: r.category, ratio: Number(r.ratio) || 0,
      perGiftCapCents: r.per_gift_cap_cents, annualCapCents: r.annual_cap_cents, active: r.active,
    }));
    members = (memberRows ?? []).map((m) => ({ id: m.id, email: m.email, role: m.role, status: m.status }));
  }

  const accountView: CorporateAccountView | null = account
    ? { id: account.id, name: account.name, emailDomain: account.email_domain, defaultMatchRatio: Number(account.default_match_ratio) || 1, annualCapCents: account.annual_cap_cents, active: account.active }
    : null;

  return (
    <CharitMeShell active="Corporate Giving">
      <TopBar title="Corporate Giving" subtitle="Register your company, set matching-gift rules, and enroll employees." />
      <div className="kf-admin-dash">
        <CorporateClient initialAccount={accountView} initialRules={rules} initialMembers={members} />
      </div>
    </CharitMeShell>
  );
}
