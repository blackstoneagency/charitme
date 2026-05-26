import type { ReactNode } from 'react';
import { KindFundShell, TopBar, KFIcon, SidePanel } from '../../../components/KindFundApp';

const featured = ['Mailchimp', 'Stripe', 'Zapier', 'Google Analytics'];
const all = ['PayPal', 'Slack', 'Constant Contact', 'QuickBooks', 'Facebook Pixel', 'HubSpot', 'Calendly', 'GoFundMe Pro', 'X (Twitter)', 'YouTube'];

export default function IntegrationsPage() {
  return (
    <KindFundShell active="Integrations">
      <TopBar title="Integrations" subtitle="Connect your favorite tools to streamline your workflow and grow your impact." />
      <div className="kf-content-grid">
        <main className="kf-content-main">
          <div className="kf-tabs page-tabs">
            <button className="active">All Integrations</button>
            <button>Connected (6)</button>
            <button>Available (18)</button>
          </div>
          <section className="kf-card kf-integration-section">
            <div className="kf-card-head">
              <h2>Featured Integrations</h2>
              <LinkLike>View all connected -&gt;</LinkLike>
            </div>
            <div className="kf-integration-grid">
              {featured.map((name, i) => <IntegrationCard key={name} name={name} connected icon={['crown', 'gift', 'send', 'chart'][i]} />)}
            </div>
          </section>
          <section className="kf-card kf-integration-section">
            <div className="kf-card-head">
              <h2>All Integrations</h2>
              <label className="kf-search"><KFIcon name="search" /><input placeholder="Search integrations..." /></label>
            </div>
            <div className="kf-integration-grid compact">{all.map((name) => <IntegrationCard key={name} name={name} />)}</div>
            <button className="kf-load">Load More Integrations</button>
          </section>
        </main>
        <SidePanel kind="support" />
      </div>
    </KindFundShell>
  );
}

function LinkLike({ children }: { children: ReactNode }) {
  return <span className="kf-link">{children}</span>;
}

function IntegrationCard({ name, connected, icon = 'link' }: { name: string; connected?: boolean; icon?: string }) {
  return (
    <article className="kf-integration">
      <div className="kf-integration-logo"><KFIcon name={icon} /></div>
      <h3>{name}</h3>
      <p>{connected ? 'Connected and syncing with KindFund.' : 'Connect and automate your fundraising workflow.'}</p>
      <Status connected={connected} />
      <button>{connected ? 'Manage' : 'Connect'}</button>
    </article>
  );
}

function Status({ connected }: { connected?: boolean }) {
  return connected ? <span className="kf-pill green">Connected</span> : null;
}
