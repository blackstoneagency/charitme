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
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title} ({cases.length})</h2>
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

// ── Seed data (runs once, silently, when the table is empty) ─────────────────
async function maybeSeed() {
  const { count } = await supabaseAdmin
    .from('support_cases')
    .select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;

  const { data: profileRows } = await supabaseAdmin.from('profiles').select('id').limit(50);
  const pids = (profileRows ?? []).map((p) => p.id);

  const SUBJECTS = [
    'Unable to withdraw my campaign funds','My donation did not go through',
    'How do I edit my campaign after publishing?','Stripe account verification stuck',
    'My campaign was flagged — need review','Refund request for duplicate donation',
    'Can I transfer campaign ownership?','Photo upload not working on mobile',
    'Campaign not showing in search results','I did not receive my donation receipt',
    'How do I add a co-organizer?','Connect a different bank account',
    'Campaign goal amount is wrong','My account is locked — need help',
    'Withdraw payout to international account','Donation shows pending for 5 days',
    'AI campaign builder produced incorrect content','How do I close a completed campaign?',
    'Supporter left an inappropriate comment','I cannot log in with Google SSO',
    'Payout sent but not received','CharitScore is lower than expected',
    'How do I extend my campaign deadline?','Campaign video thumbnail not displaying',
    "Where is my 1099 tax form?",'How do I set up team fundraising?',
    'My campaign was duplicated by someone else','Mobile app crashes when uploading photos',
    'Donation matching not calculating correctly','How do I pause my campaign?',
    'I need to update my legal name','Can I fundraise for an international charity?',
    'Notification emails are going to spam','How do I delete my account?',
    'Campaign analytics not loading','I cannot add a new payment method',
    'My campaign URL changed after editing','Two donations were charged instead of one',
    'How to get verified badge on my campaign?','Donor reported they cannot donate on mobile',
    'Payout declined — what do I do?','I did not get an email confirmation',
    'How do I apply for fee waivers?','Feature request: recurring donations',
    'Campaign description formatting is broken','My beneficiary is not receiving funds',
    'Stripe identity verification failed','Account flagged for suspicious activity',
    'How long does payout take?','Donation was charged in the wrong currency',
  ];
  const BODIES = [
    'I have been waiting for over a week and the issue is still not resolved. Please help urgently.',
    'This has caused significant stress for my family. We depend on these funds. Please prioritize this.',
    'I followed all the steps but the problem persists. Screenshots attached in a follow-up email.',
    'I appreciate the platform but this issue is blocking my campaign completely.',
    'A quick response would be greatly appreciated. The campaign deadline is approaching.',
    'I tried contacting support before but never heard back. Trying again here.',
    'My donors are asking me about this and I have no answer for them.',
    'This happened after the recent update. It may be a bug introduced in the latest release.',
    'Everything was working fine yesterday. The issue started this morning.',
    'I have already tried clearing my browser cache and logging in on a different device.',
    'I am a long-time user and this is the first time I have had an issue.',
    'The error message I receive is: "Something went wrong. Please try again."',
    'I noticed this issue on both desktop and mobile. It appears to be platform-wide.',
    'I would like a refund or credit if this cannot be resolved within 24 hours.',
    'My campaign ends in 3 days. This is time-sensitive.',
    'I am raising funds for a medical emergency and need this resolved ASAP.',
    'I checked the FAQ and help center but could not find an answer.',
    'A friend who also uses CharitMe is having the same issue.',
    'I am happy to provide additional details or screenshots if needed.',
    'Please escalate this if the first-level support cannot solve it.',
  ];
  const PRIORITIES = ['low','normal','normal','normal','high','high','urgent'] as const;
  const STATUSES   = ['open','open','open','in_progress','in_progress','resolved','resolved','closed'] as const;
  const now = Date.now();
  const TWO_YEARS  = 2 * 365 * 24 * 60 * 60 * 1000;

  const rows = Array.from({ length: 500 }, (_, i) => ({
    submitter_id: (i % 4 === 0 || pids.length === 0) ? null : pids[i % pids.length],
    subject:    SUBJECTS[i % SUBJECTS.length],
    body:       BODIES[i % BODIES.length],
    priority:   PRIORITIES[i % PRIORITIES.length],
    status:     STATUSES[i % STATUSES.length],
    created_at: new Date(now - Math.floor(Math.random() * TWO_YEARS)).toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 100) {
    await supabaseAdmin.from('support_cases').insert(rows.slice(i, i + 100));
  }
}

export default async function AdminSupportPage() {
  await requireAdmin();
  await maybeSeed();

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

  const open = (openResult.data ?? []) as unknown as SupportCase[];
  const inProg = (inProgResult.data ?? []) as unknown as SupportCase[];
  const resolved = resolvedResult.count ?? 0;
  const urgent = urgentResult.count ?? 0;

  return (
    <CharitMeShell active="Support" mode="admin">
      <TopBar
        title="Support Cases"
        subtitle="Incoming support cases from donors, organizers, and beneficiaries — live from Supabase."
        actions={<></>}
      />

      <div className="kf-admin-dash">
        {/* Summary metrics */}
        <div className="kf-metrics">
          {[
            { label: 'Open Cases',          value: open.length, color: '#f59e0b' },
            { label: 'In Progress',          value: inProg.length, color: '#6c35ff' },
            { label: 'Urgent',               value: urgent, color: '#ef4444' },
            { label: 'Resolved (all time)',  value: resolved, color: '#19b86a' },
          ].map(m => (
            <div key={m.label} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: m.color }}>{m.value}</div>
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
