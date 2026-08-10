import { boundedQuery } from '../../../lib/query-timeout';
import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { isAdmin } from '../../../lib/roles';
import { supabaseAdmin } from '../../../lib/supabase';
import { listManageableGivingDays, ownedNonprofitIds } from '../../../lib/giving-days-server';
import { EmptyState } from '../../../components/ui';
import GivingDaysClient from './GivingDaysClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Giving Days | CharitMe' };

// The management surface for `giving_days` — one of 27 tables that shipped with
// RLS and a foreign key and no code on either side of it.
//
// The list is scoped by `listManageableGivingDays`, which filters to the
// nonprofits this account owns unless it is an admin. That mirrors the
// `giving_days_owner_write` policy, which does NOT run here: these reads go
// through the service-role client.

/** `null` = the ownership read failed. `[]` = this account owns no organisation. */
async function ownedNonprofits(userId: string): Promise<{ id: string; name: string }[] | null> {
  const ids = await ownedNonprofitIds(userId);
  if (ids === null) return null;
  if (ids.length === 0) return [];
  const { data } = await boundedQuery(() => supabaseAdmin
    .from('nonprofit_profiles')
    .select('id, name')
    .in('id', ids)
    .order('name', { ascending: true }));
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string }));
}

export default async function DashboardGivingDaysPage() {
  const user = await requireUser();
  const admin = await isAdmin(user.id, user.email);
  const [nonprofits, days] = await Promise.all([
    ownedNonprofits(user.id),
    listManageableGivingDays(user.id, admin),
  ]);

  // ⚠️ A failed ownership read is not an account without an organisation. With
  // `[]` the client renders its "set one up first" empty state, which sends an
  // existing owner to re-create something they already have.
  if (nonprofits === null) {
    return (
      <CharitMeShell active="Giving Days">
        <TopBar title="Giving Days" subtitle="A fixed window when your whole community gives together." />
        <div style={{ padding: '0 32px 40px' }}>
          <EmptyState
            title="We could not load your organisations"
            body="This is a read failure, not an empty account — your giving days are still there. Try again in a moment."
          />
        </div>
      </CharitMeShell>
    );
  }

  return (
    <CharitMeShell active="Giving Days">
      <TopBar
        title="Giving Days"
        subtitle="A fixed window when your whole community gives together."
      />
      <div style={{ padding: '0 32px 40px' }}>
        <GivingDaysClient
          nonprofits={nonprofits}
          initialDays={(days ?? []).map((d) => ({
            id: d.id,
            slug: d.slug,
            title: d.title,
            starts_at: d.starts_at,
            ends_at: d.ends_at,
            goal_amount: d.goal_amount,
            phase: d.phase,
            raisedCents: d.raisedCents,
          }))}
          // A failed read and an empty list are different facts and must not
          // render as the same sentence.
          loadFailed={days === null}
        />
      </div>
    </CharitMeShell>
  );
}
