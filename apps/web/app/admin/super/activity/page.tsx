import { boundedQuery } from '../../../../lib/query-timeout';
import 'server-only';
import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { requireSuperAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

type Log = {
  id: string; actor_id: string | null; action: string; target_type: string | null;
  target_id: string | null; metadata: unknown; created_at: string;
};

function tone(action: string): string {
  if (action.includes('delete') || action.includes('suspend')) return 'red';
  if (action.includes('create')) return 'green';
  if (action.includes('update') || action.includes('upsert') || action.includes('set')) return 'orange';
  return 'violet';
}

export default async function SuperAdminActivityPage() {
  await requireSuperAdmin();

  const { data: logs } = await boundedQuery(() => supabaseAdmin
    .from('audit_logs')
    .select('id, actor_id, action, target_type, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(300));

  const rows = (logs ?? []) as Log[];
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
  const { data: actors } = actorIds.length
    ? await boundedQuery(() => supabaseAdmin.from('profiles').select('id, full_name, email').in('id', actorIds))
    : { data: [] };
  const actorMap = new Map((actors ?? []).map((a) => [a.id as string, (a.full_name as string) || (a.email as string)]));

  return (
    <CharitMeShell active="Activity Log" mode="admin">
      <TopBar title="Activity Log" subtitle={`${rows.length} recent actions · audit_logs`} />
      <div style={{ padding: '0 4px 48px' }}>
        <div className="kf-card" style={{ padding: 16 }}>
          {rows.length === 0 && <p style={{ color: 'var(--t3)', fontSize: 13 }}>No audited actions yet. Super-admin actions (role changes, settings, flags, marketing) appear here.</p>}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, padding: '10px 4px', borderTop: '1px solid var(--b1)' }}>
                <span className={`kf-pill ${tone(r.action)}`} style={{ minWidth: 130, textAlign: 'center' }}>{r.action}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{actorMap.get(r.actor_id ?? '') ?? 'System'}</strong>
                  <small style={{ display: 'block', color: 'var(--t3)' }}>
                    {r.target_type ?? ''}{r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ''}
                    {r.metadata && Object.keys(r.metadata as object).length > 0 ? ` · ${JSON.stringify(r.metadata).slice(0, 80)}` : ''}
                  </small>
                </div>
                <small style={{ color: 'var(--t3)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CharitMeShell>
  );
}
