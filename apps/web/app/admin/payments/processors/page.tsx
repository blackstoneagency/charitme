import { CharitMeShell, TopBar } from '../../../../components/CharitMeShellServer';
import { getProcessorRows } from '../../../../lib/payment-admin-data';
import { Pill } from '../_components/PaymentAdminParts';

export const dynamic = 'force-dynamic';

export default async function PaymentProcessorsPage(): Promise<JSX.Element> {
  const processors = await getProcessorRows();
  return (
    <CharitMeShell active="Payment Flows" mode="admin">
      <TopBar title="Payment Processors" subtitle="Enabled processors and disabled setup states from Supabase." />
      <div style={{ padding: '0 32px 40px' }}>
        <div style={{ background: '#fff', border: '1px solid #e8ecf4', borderRadius: 16, overflow: 'hidden' }}>
          {processors.map(row => (
            <div key={row.processor} style={{ padding: 18, borderTop: '1px solid #edf1f7', display: 'flex', justifyContent: 'space-between', gap: 18 }}>
              <div>
                <strong style={{ color: '#111944' }}>{row.display_name}</strong>
                <p style={{ color: '#64748b', margin: '4px 0 0', fontWeight: 800 }}>{row.processor}</p>
              </div>
              <Pill value={row.status} />
            </div>
          ))}
        </div>
      </div>
    </CharitMeShell>
  );
}
