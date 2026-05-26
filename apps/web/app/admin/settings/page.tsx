import { PageScaffold, KFIcon, type Metric, type TableRow } from '../../../components/KindFundApp';

const metrics: Metric[] = [
  { label: 'Categories', value: '12', icon: 'grid', tone: 'violet' },
  { label: 'Configurations', value: '45', icon: 'settings', tone: 'blue' },
  { label: 'Integrations', value: '8', icon: 'link', tone: 'green' },
  { label: 'Last Updated', value: 'Today', icon: 'calendar', tone: 'orange' },
];

const rows: TableRow[] = [
  { title: 'General', subtitle: 'Platform name, support email, currency', status: 'Active', amount: 'Configured', meta: ['Core settings'] },
  { title: 'Branding', subtitle: 'Logo, favicon, colors, social preview', status: 'Active', amount: 'KindFund', meta: ['Public identity'] },
  { title: 'Email', subtitle: 'Sender, reply-to, templates, verification', status: 'Verified', amount: 'SendGrid', meta: ['Transactional'] },
  { title: 'Payment', subtitle: 'Stripe, PayPal, platform fees, payout methods', status: 'Active', amount: 'Live', meta: ['Gateway'] },
  { title: 'Security', subtitle: 'Password policy, two-factor authentication, sessions', status: 'Active', amount: 'Strong', meta: ['Access control'] },
];

export default function AdminSettingsPage() {
  return (
    <PageScaffold
      mode="admin"
      active="Settings"
      title="System Settings"
      subtitle="Configure and manage platform settings to control how KindFund works."
      metrics={metrics}
      rows={rows}
      side={false}
    >
      <div className="kf-two-col">
        <section className="kf-card">
          <div className="kf-card-head">
            <h2>Review Changes</h2>
            <button className="kf-primary">Save Changes</button>
          </div>
          <div className="kf-settings">
            <SettingToggle icon="shield" label="Allow New Registrations" />
            <SettingToggle icon="doc" label="Email Verification" />
            <SettingToggle icon="gear" label="Two-Factor for Admins" />
            <SettingToggle icon="chart" label="Platform Analytics" />
          </div>
        </section>
        <section className="kf-card kf-ai-card">
          <div className="kf-card-head"><h2>Audit Summary</h2><button>View Audit Log</button></div>
          {['Email settings updated', 'Payment gateway verified', 'Maintenance mode disabled'].map((item) => (
            <p className="kf-activity" key={item}><span className="kf-square violet"><KFIcon name="audit" /></span><span>{item}<small>Updated by Admin User</small></span></p>
          ))}
        </section>
      </div>
    </PageScaffold>
  );
}

function SettingToggle({ icon, label }: { icon: string; label: string }) {
  return <div><span><KFIcon name={icon} /></span><b>{label}</b><input type="checkbox" defaultChecked /></div>;
}
