import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getProcessorRows } from '../../../../lib/payment-admin-data';
import { Pill } from '../_components/PaymentAdminParts';
import { PaymentsSubnav } from '../_components/PaymentsSubnav';

export const dynamic = 'force-dynamic';

export default async function PaymentProcessorsPage(): Promise<JSX.Element> {
  const processors = await getProcessorRows();
  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Payment Processors" subtitle="Enabled processors and disabled setup states from Supabase." />
      <div className="kf-admin-dash">
        <PaymentsSubnav />
        <div style={{ background: 'var(--s1)', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
          {processors.map(row => (
            <div key={row.processor} style={{ padding: 18, borderTop: '1px solid #edf1f7', display: 'flex', flexWrap: 'wrap', minWidth: 0, justifyContent: 'space-between', gap: 18 }}>
              <div>
                <strong style={{ color: 'var(--t1)' }}>{row.display_name}</strong>
                <p style={{ color: 'var(--t3)', margin: '4px 0 0', fontWeight: 650 }}>{row.processor}</p>
              </div>
              <Pill value={row.status} />
            </div>
          ))}
        </div>
      </div>
    </CharitMeShell>
  );
}
