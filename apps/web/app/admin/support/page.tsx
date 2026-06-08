import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type SupportCase = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  submitter_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: '#6c35ff',
  low: '#6b7280',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#f59e0b',
  in_progress: '#6c35ff',
  resolved: '#19b86a',
  closed: '#6b7280',
};

function CaseTable({ cases, title }: { cases: SupportCase[]; title: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f4f8' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title} ({cases.length})</h2>
      </div>
      {cases.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No cases</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Submitter', 'Subject', 'Priority', 'Status', 'Created'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c, i) => (
              <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{(c.profiles as { full_name?: string | null } | null)?.full_name ?? 'Guest'}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{(c.profiles as { email?: string | null } | null)?.email ?? ''}</div>
                </td>
                <td style={{ padding: '12px 16px', color: '#334064', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.subject}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: (PRIORITY_COLOR[c.priority] ?? '#6b7280') + '18', color: PRIORITY_COLOR[c.priority] ?? '#6b7280', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                    {c.priority}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: (STATUS_COLOR[c.status] ?? '#6b7280') + '18', color: STATUS_COLOR[c.status] ?? '#6b7280', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function AdminSupportPage() {
  await requireAdmin();

  // Try to query support_cases — table may not exist yet
  const [openResult, inProgResult, resolvedResult] = await Promise.all([
    supabaseAdmin
      .from('support_cases')
      .select('id, subject, status, priority, created_at, submitter_id, profiles:submitter_id(full_name, email)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('support_cases')
      .select('id, subject, status, priority, created_at, submitter_id, profiles:submitter_id(full_name, email)')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('support_cases')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'resolved'),
  ]);

  // Detect if the table doesn't exist yet
  const tableNotFound =
    openResult.error?.code === '42P01' ||
    openResult.error?.message?.includes('does not exist') ||
    openResult.error?.message?.includes('relation') ;

  if (tableNotFound) {
    // Fall back: show donor_messages as lightweight support proxy
    const { data: messages } = await supabaseAdmin
      .from('donor_messages')
      .select('id, message, campaign_id, donor_id, created_at, anonymous')
      .order('created_at', { ascending: false })
      .limit(50);

    const campaignIds = [...new Set((messages ?? []).map((m: { campaign_id: string }) => m.campaign_id).filter(Boolean))];
    const campaignMap = new Map<string, string>();
    if (campaignIds.length > 0) {
      const { data: camps } = await supabaseAdmin.from('campaigns').select('id,title').in('id', campaignIds);
      for (const c of (camps ?? []) as { id: string; title: string }[]) campaignMap.set(c.id, c.title);
    }

    const donorIds = [...new Set((messages ?? []).filter((m: { anonymous: boolean }) => !m.anonymous).map((m: { donor_id: string }) => m.donor_id).filter(Boolean))];
    const profileMap = new Map<string, string>();
    if (donorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id,full_name').in('id', donorIds);
      for (const p of (profiles ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) profileMap.set(p.id, p.full_name);
      }
    }

    return (
      <CharitMeShell active="Support" mode="admin">
        <TopBar
          title="Support"
          subtitle="Donor messages and campaign communications."
          actions={<></>}
        />
        <div style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Setup banner */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '18px 24px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: '#92400e', marginBottom: 4 }}>Support Cases table not set up yet</div>
              <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                Run <code style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>supabase/migrations/20240001_support_cases.sql</code> in your Supabase SQL Editor to enable full support case management.
              </div>
              <Link href="/admin/setup" style={{ display: 'inline-block', marginTop: 10, padding: '7px 16px', background: '#f59e0b', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                Go to Setup Diagnostic →
              </Link>
            </div>
          </div>

          {/* Show donor messages as proxy */}
          <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f4f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Donor Messages ({(messages ?? []).length})</h2>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Showing donor_messages as proxy until support_cases is created</span>
            </div>
            {(messages ?? []).length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No messages yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Donor', 'Campaign', 'Message', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(messages ?? []).map((m: { id: string; message: string; campaign_id: string; donor_id: string; created_at: string; anonymous: boolean }, i: number) => (
                    <tr key={m.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e' }}>
                        {m.anonymous ? 'Anonymous' : (profileMap.get(m.donor_id) ?? 'Donor')}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {campaignMap.get(m.campaign_id) ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334064', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.message}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </CharitMeShell>
    );
  }

  const open = (openResult.data ?? []) as unknown as SupportCase[];
  const inProg = (inProgResult.data ?? []) as unknown as SupportCase[];
  const resolved = resolvedResult.count ?? 0;

  return (
    <CharitMeShell active="Support" mode="admin">
      <TopBar
        title="Support Cases"
        subtitle="Incoming support cases from donors, organizers, and beneficiaries."
        actions={<></>}
      />

      <div style={{ padding: '0 32px 40px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Summary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'Open Cases', value: open.length, color: '#f59e0b' },
            { label: 'In Progress', value: inProg.length, color: '#6c35ff' },
            { label: 'Resolved (all time)', value: resolved, color: '#19b86a' },
          ].map(m => (
            <div key={m.label} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        <CaseTable cases={open} title="Open Cases" />
        {inProg.length > 0 && <CaseTable cases={inProg} title="In Progress" />}

        {open.length === 0 && inProg.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, padding: '48px 32px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', marginBottom: 6 }}>No open support cases</div>
            <div style={{ fontSize: 13 }}>All caught up! Resolved cases: {resolved}</div>
          </div>
        )}
      </div>
    </CharitMeShell>
  );
}
