import { KindFundShell, TopBar, KFIcon, sampleImages, SidePanel } from '../../../components/KindFundApp';

const steps = ['Create a compelling video', 'Share to Facebook & Instagram', 'Email your past supporters', 'Post an update', 'Set up an offline fundraiser', 'Ask your community to share', 'Thank your donors'];

export default function AiGrowthPlanPage() {
  return (
    <KindFundShell active="AI Growth Plan">
      <TopBar title="AI Growth Plan" subtitle="Your personalized plan to reach more people and raise more." actions={<button className="kf-outline"><KFIcon name="upload" /> Export Plan</button>} />
      <div className="kf-content-grid">
        <main className="kf-content-main">
          <section className="kf-card kf-campaign-hero"><div className="kf-hero-img" style={{ backgroundImage: `url(${sampleImages.mia})` }} /><div><Status /> <h2>Help Mia Get Life-Saving Heart Surgery</h2><p>Your campaign is performing better than 68% of similar campaigns.</p><div className="kf-metrics mini"><b>487<small>Donations</small></b><b>$24,350<small>Raised</small></b><b>12,450<small>Views</small></b><b>2.4K<small>Shares</small></b></div></div></section>
          <section className="kf-card kf-roadmap"><div className="kf-card-head"><h2>Your 7-Step AI Growth Roadmap</h2><div className="kf-tabs compact"><button className="active">All Steps</button><button>To Do (3)</button><button>In Progress (2)</button><button>Completed (2)</button></div></div>{steps.map((step, i) => <article key={step}><span className={i < 2 ? 'done' : ''}>{i < 2 ? '✓' : i + 1}</span><div><strong>{step}</strong><p>{i === 0 ? 'Videos can increase donations by up to 80%.' : 'AI will guide you through this action.'}</p></div><button>{i < 2 ? 'Done' : i === 1 ? 'Share Now' : 'Start'}</button><em>{i < 4 ? 'High Impact' : 'Low Impact'}</em></article>)}</section>
        </main>
        <SidePanel />
      </div>
    </KindFundShell>
  );
}

function Status() { return <span className="kf-pill green">On Track</span>; }
