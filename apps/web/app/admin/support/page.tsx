import 'server-only';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import AiTriageButton from './AiTriageButton';

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
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>{title} ({cases.length})</h2>
      </div>
      {cases.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No cases</div>
      ) : (
        <div className="kf-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Submitter', 'Subject', 'Priority', 'Status', 'Created', 'AI'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c, i) => (
              <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: '#1a1a2e' }}>
                    {(c.profiles as { full_name?: string | null } | null)?.full_name ?? 'Guest'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {(c.profiles as { email?: string | null } | null)?.email ?? ''}
                  </div>
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
                <td style={{ padding: '12px 16px' }}>
                  <AiTriageButton caseId={c.id} subject={c.subject} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}


export default async function AdminSupportPage() {
  await requireAdmin();

  const [openResult, inProgResult, resolvedResult, urgentResult] = await Promise.all([
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
    supabaseAdmin
      .from('support_cases')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'urgent')
      .in('status', ['open', 'in_progress']),
  ]);

  // `count` is null and `data` is null whenever a query errors, so `?? 0` / `?? []`
  // reported **"Urgent: 0"** and an empty case list — telling a support admin that
  // nothing needs attention at the exact moment the database could not answer.
  // Zero is the favourable answer here, so it needs proof.
  const openFailed = Boolean(openResult.error) || openResult.data == null;
  const inProgFailed = Boolean(inProgResult.error) || inProgResult.data == null;
  const resolvedUnknown = Boolean(resolvedResult.error) || resolvedResult.count == null;
  const urgentUnknown = Boolean(urgentResult.error) || urgentResult.count == null;
  const listsFailed = openFailed || inProgFailed;

  const open = (openResult.data ?? []) as unknown as SupportCase[];
  const inProg = (inProgResult.data ?? []) as unknown as SupportCase[];
  const resolved = resolvedResult.count ?? 0;
  const urgent = urgentResult.count ?? 0;
  const show = (unknown: boolean, value: number) => (unknown ? '—' : String(value));

  return (
    <CharitMeShell active="Support" mode="admin">
      <TopBar
        title="Support Cases"
        subtitle="Incoming support cases from donors, organizers, and beneficiaries — live from Supabase."
        actions={<></>}
      />

      <div className="kf-admin-dash">
        {listsFailed && (
          <div
            role="alert"
            style={{
              margin: '0 0 16px', padding: '14px 16px', borderRadius: 12,
              background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>We couldn&apos;t load the case list</strong>
            <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              No cases have been lost, and this is not an empty queue — the read failed.
              Anything showing &ldquo;—&rdquo; is unknown, not zero. Reload before
              treating the queue as clear.
            </span>
          </div>
        )}
        {/* Summary metrics */}
        <div className="kf-metrics">
          {[
            { label: 'Open Cases',          value: show(openFailed, open.length), color: '#f59e0b' },
            { label: 'In Progress',          value: show(inProgFailed, inProg.length), color: '#6c35ff' },
            { label: 'Urgent',               value: show(urgentUnknown, urgent), color: '#ef4444' },
            { label: 'Resolved (all time)',  value: show(resolvedUnknown, resolved), color: '#19b86a' },
          ].map(m => (
            <div key={m.label} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {open.length > 0 && <CaseTable cases={open} title="Open Cases" />}
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
