import { KindFundShell, TopBar, KFIcon, SidePanel } from '../../../components/KindFundApp';

export default function SettingsPage() {
  const sections = ['General', 'Profile', 'Organization', 'Notifications', 'Security', 'Payment Methods', 'Email Templates', 'Privacy', 'Billing & Plan', 'Data & Export', 'Advanced'];
  return (
    <KindFundShell active="Settings">
      <TopBar title="Settings" subtitle="Manage your account, preferences, and organization settings." actions={<button className="kf-primary">Save Changes</button>} />
      <div className="kf-content-grid">
        <main className="kf-settings-layout">
          <nav className="kf-settings-nav">{sections.map((s, i) => <a key={s} className={i === 0 ? 'active' : ''}><KFIcon name={i === 0 ? 'gear' : i === 3 ? 'bell' : i === 5 ? 'wallet' : 'doc'} /> {s}</a>)}</nav>
          <section className="kf-card kf-form-card">
            <div className="kf-card-head"><div><h2>General Settings</h2><p>Manage your general preferences and platform settings.</p></div><button className="kf-primary">Save Changes</button></div>
            <FormBlock title="Organization Information" fields={['Organization Name', 'Website', 'Tagline', 'Time Zone']} />
            <FormBlock title="Currency & Locale" fields={['Currency', 'Language']} />
            <FormBlock title="Date & Time Format" fields={['Date Format', 'Time Format']} />
          </section>
        </main>
        <SidePanel kind="status" />
      </div>
    </KindFundShell>
  );
}

function FormBlock({ title, fields }: { title: string; fields: string[] }) {
  return <div className="kf-form-block"><h3>{title}</h3><div className="kf-form-grid">{fields.map((f) => <label key={f}>{f}<input defaultValue={f.includes('Name') ? 'Helping Hands Foundation' : f.includes('Website') ? 'https://www.helpinghands.org' : f.includes('Tagline') ? 'Together, we can build a better tomorrow.' : f} /></label>)}</div></div>;
}
