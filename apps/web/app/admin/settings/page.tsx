import 'server-only';
import { PageScaffold, type Metric, type TableRow } from '../../../components/KindFundShellServer';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [
    { count: totalProfiles },
    { count: publicProfiles },
    { count: recommendationProfiles },
    { count: paidPlans },
    { data: timezones },
    { data: currencies },
    { count: stripeCustomers },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('show_public_profile', true),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('campaign_recommendations', true),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).neq('plan', 'free'),
    supabaseAdmin.from('profiles').select('timezone').not('timezone', 'is', null).limit(1000),
    supabaseAdmin.from('profiles').select('currency').not('currency', 'is', null).limit(1000),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).not('stripe_customer_id', 'is', null),
  ]);

  const timezoneSet = new Set((timezones ?? []).map((row) => (row as { timezone: string | null }).timezone).filter(Boolean));
  const currencySet = new Set((currencies ?? []).map((row) => (row as { currency: string | null }).currency).filter(Boolean));
  const total = totalProfiles ?? 0;

  const rows: TableRow[] = [
    {
      title: 'Public Profiles',
      subtitle: 'Users allowing a visible public profile',
      status: 'Synced',
      amount: `${publicProfiles ?? 0} enabled`,
      meta: ['profiles.show_public_profile'],
    },
    {
      title: 'Campaign Recommendations',
      subtitle: 'Users opted into AI campaign recommendations',
      status: 'Synced',
      amount: `${recommendationProfiles ?? 0} enabled`,
      meta: ['profiles.campaign_recommendations'],
    },
    {
      title: 'Billing Plans',
      subtitle: 'Profiles with a paid plan configured',
      status: 'Synced',
      amount: `${paidPlans ?? 0} paid`,
      meta: ['profiles.plan'],
    },
    {
      title: 'Stripe Customers',
      subtitle: 'Profiles linked to Stripe customer records',
      status: 'Synced',
      amount: `${stripeCustomers ?? 0} linked`,
      meta: ['profiles.stripe_customer_id'],
    },
    {
      title: 'Timezones',
      subtitle: 'Distinct timezone preferences in use',
      status: 'Synced',
      amount: `${timezoneSet.size} values`,
      meta: ([...timezoneSet].slice(0, 2) as string[]).filter(Boolean),
    },
    {
      title: 'Currencies',
      subtitle: 'Distinct currency preferences in use',
      status: 'Synced',
      amount: `${currencySet.size} values`,
      meta: ([...currencySet].slice(0, 2) as string[]).filter(Boolean),
    },
  ];

  const metrics: Metric[] = [
    { label: 'Profiles', value: total.toLocaleString(), change: 'configurable accounts', icon: 'users', tone: 'violet' },
    { label: 'Public Profiles', value: total ? `${Math.round(((publicProfiles ?? 0) / total) * 100)}%` : '0%', change: `${publicProfiles ?? 0} enabled`, icon: 'check', tone: 'green' },
    { label: 'Paid Plans', value: (paidPlans ?? 0).toLocaleString(), change: 'non-free plans', icon: 'gift', tone: 'blue' },
    { label: 'Stripe Links', value: (stripeCustomers ?? 0).toLocaleString(), change: 'customer ids', icon: 'link', tone: 'orange' },
  ];

  return (
    <PageScaffold
      mode="admin"
      active="Settings"
      title="System Settings"
      subtitle="Live account and billing configuration values from Supabase profiles."
      metrics={metrics}
      rows={rows}
      tabs={['All Settings', 'Profiles', 'Billing', 'Preferences']}
      side={false}
    />
  );
}
