import type { Metadata } from 'next';
import Link from 'next/link';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import { requireUser } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { API_SCOPES } from '../../../lib/api-keys';
import { DevelopersClient, type ApiKey } from './_components/DevelopersClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Developers | CharitMe' };

// `api_keys` had a full schema — key_hash, scopes, revoked_at, last_used_at —
// and no reader or writer anywhere in the app. This screen and /api/v1 are what
// make it real.

async function fetchKeys(userId: string): Promise<ApiKey[]> {
  try {
    // key_hash is deliberately not selected; it has no business leaving the
    // database, let alone reaching a browser.
    const { data } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, scopes, last_used_at, revoked_at, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    return (data ?? []) as ApiKey[];
  } catch {
    return [];
  }
}

export default async function DevelopersPage() {
  const user = await requireUser();
  const keys = await fetchKeys(user.id);

  return (
    <CharitMeShell active="Developers">
      <TopBar title="Developers" subtitle="API keys for the CharitMe public API." />
      <div className="kf-content-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="kf-content-main">
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--t3)' }}>
            Read the{' '}
            <Link href="/developers" style={{ color: 'var(--violet-ink)', fontWeight: 700 }}>
              API documentation
            </Link>{' '}
            for endpoints, scopes and examples.
          </p>
          <DevelopersClient initialKeys={keys} availableScopes={API_SCOPES} />
        </div>
      </div>
    </CharitMeShell>
  );
}
