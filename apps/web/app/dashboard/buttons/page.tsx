import 'server-only';
import type { Metadata } from 'next';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import ButtonsClient from './ButtonsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Embed Buttons | CharitMe' };

// `embedded_buttons` — the persistent form of the per-campaign widget
// configurator, which builds a snippet and forgets it. A fundraiser who wants
// the same button on three pages configured it three times and had no way to
// change them together.

type ButtonRow = {
  id: string;
  label: string;
  button_type: string;
  campaign_id: string | null;
  config: unknown;
  created_at: string;
};

/** `null` means the read FAILED — never conflated with "no buttons yet". */
async function loadButtons(userId: string): Promise<ButtonRow[] | null> {
  try {    // supabaseAdmin is a Proxy that THROWS on property access when the env is
    // missing, so `.from(...)` throws before any query runs — which the error
    // check below cannot see. The `null` contract this function already
    // declares is the correct degraded answer, so a throw takes the same path.

    const { data, error } = await supabaseAdmin
      .from('embedded_buttons')
      .select('id, label, button_type, campaign_id, config, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.warn('[dashboard/buttons] read failed', { code: error.code });
      return null;
    }
    return (data ?? []) as ButtonRow[];
  
  } catch {
    return null;
  }
}

async function loadCampaigns(userId: string) {
  const { data } = await supabaseAdmin
    .from('campaigns')
    .select('id, title, slug')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []).map((c) => ({ id: c.id as string, title: c.title as string, slug: c.slug as string }));
}

export default async function DashboardButtonsPage() {
  const user = await requireUser();
  const [buttons, campaigns] = await Promise.all([loadButtons(user.id), loadCampaigns(user.id)]);

  return (
    <CharitMeShell active="Embed Buttons">
      <TopBar
        title="Embed Buttons"
        subtitle="Saved donate buttons you can paste anywhere — configured once, reusable."
      />
      <div style={{ padding: '0 32px 40px' }}>
        <ButtonsClient
          campaigns={campaigns}
          initialButtons={buttons ?? []}
          loadFailed={buttons === null}
        />
      </div>
    </CharitMeShell>
  );
}
