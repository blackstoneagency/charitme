import 'server-only';
import Link from 'next/link';
import { requireAdmin } from '../../../lib/auth';
import { supabaseAdmin } from '../../../lib/supabase';
import { CharitMeShell, TopBar } from '../../../components/CharitMeShellServer';
import RunFraudScanButton from './RunFraudScanButton';

export const dynamic = 'force-dynamic';

type RiskFlag = {
  id: string;
  flag_type: string;
  severity: string;
  description: string | null;
  resolved: boolean;
  created_at: string;
  campaign_id: string | null;
  campaigns: { title: string; slug: string } | null;
};

type CampaignReport = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  campaign_id: string;
  campaigns: { title: string; slug: string } | null;
};

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#f59e0b',
  investigating: '#6c35ff',
  resolved: '#19b86a',
  dismissed: '#6b7280',
};

export default async function TrustSafetyPage() {
  await requireAdmin();

  const [flagsResult, reportsResult, frozenResult] = await Promise.all([
    supabaseAdmin
      .from('risk_flags')
      .select('id, flag_type, severity, description, resolved, created_at, campaign_id, campaigns:campaign_id(title, slug)')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('campaign_reports')
      .select('id, reason, status, created_at, campaign_id, campaigns:campaign_id(title, slug)')
      .in('status', ['open', 'investigating'])
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('campaigns')
      .select('id, title, slug, status, trust_status')
      .eq('payout_frozen', true)
      .limit(20),
  ]);

  const flags = (flagsResult.data ?? []) as unknown as RiskFlag[];
  const reports = (reportsResult.data ?? []) as unknown as CampaignReport[];
  const frozen = frozenResult.data ?? [];

  const sev = (s: string) => SEV_COLOR[s] ?? '#6b7280';

  return (
    <CharitMeShell active="Trust & Safety" mode="admin">
      <TopBar
        title="Trust & Safety"
        subtitle="AI risk flags, campaign reports, and frozen payouts."
        actions={<RunFraudScanButton />}
      />

      <div className="kf-admin-dash">

        {/* Summary stats */}
        <div className="kf-three-col">
          {[
            { label: 'Unresolved Risk Flags', value: flags.length, color: '#ef4444' },
            { label: 'Open Reports', value: reports.length, color: '#f59e0b' },
            { label: 'Frozen Payouts', value: frozen.length, color: '#6c35ff' },
          ].map(m => (
            <div key={m.label} style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Risk Flags */}
        <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f4f8' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>Unresolved Risk Flags</h2>
          </div>
          {flags.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>✅ No unresolved risk flags</div>
          ) : (
            <div className="kf-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Campaign', 'Flag Type', 'Severity', 'Created', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flags.map((f, i) => (
                  <tr key={f.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined }}>
                    <td style={{ padding: '12px 16px' }}>
                      {f.campaigns ? (
                        <Link href={`/campaigns/${f.campaigns.slug}`} style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>
                          {f.campaigns.title}
                        </Link>
                      ) : <span style={{ color: '#94a3b8' }}>Unknown</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334064' }}>{f.flag_type.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: sev(f.severity) + '18', color: sev(f.severity), padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                        {f.severity}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <ResolveFlag id={f.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Campaign Reports */}
        <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f4f8' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>Campaign Reports</h2>
          </div>
          {reports.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>✅ No open reports</div>
          ) : (
            <div className="kf-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Campaign', 'Reason', 'Status', 'Reported', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined }}>
                    <td style={{ padding: '12px 16px' }}>
                      {r.campaigns ? (
                        <Link href={`/campaigns/${r.campaigns.slug}`} style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>
                          {r.campaigns.title}
                        </Link>
                      ) : <span style={{ color: '#94a3b8' }}>Unknown</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334064' }}>{r.reason}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: (STATUS_COLOR[r.status] ?? '#6b7280') + '18', color: STATUS_COLOR[r.status] ?? '#6b7280', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                      <Link href={`/admin/campaigns?report=${r.id}`}
                        style={{ fontSize: 12, padding: '5px 12px', background: '#f0f4ff', color: '#6c35ff', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Frozen Campaigns */}
        {frozen.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f4f8' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>Frozen Payouts</h2>
            </div>
            <div className="kf-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Campaign', 'Status', 'Trust Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {frozen.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f0f4f8' : undefined }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/campaigns/${c.slug}`} style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>
                        {c.title}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', textTransform: 'capitalize' }}>{c.status}</td>
                    <td style={{ padding: '12px 16px', color: '#f59e0b', fontWeight: 600 }}>{c.trust_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </CharitMeShell>
  );
}

function ResolveFlag({ id }: { id: string }) {
  return (
    <form action={`/api/admin/trust/flags/${id}/resolve`} method="POST" style={{ display: 'inline' }}>
      <button type="submit" style={{ fontSize: 12, padding: '5px 12px', background: '#f0fff4', color: '#19b86a', borderRadius: 8, fontWeight: 700, border: '1px solid #bbf7d0', cursor: 'pointer' }}>
        Resolve
      </button>
    </form>
  );
}
