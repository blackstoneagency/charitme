import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../components/PublicIcon';

export const metadata: Metadata = {
  title: 'AI Fundraising',
  description: 'CharitMe AI tools help fundraisers create campaigns, connect with donors, and optimize results.',
};

const tools = [
  ['edit', 'AI Story Writer', 'Create heartfelt, compelling stories that inspire donors in seconds.', 'Try it now'],
  ['users', 'Smart Donor Insights', 'Find the right donors with AI recommendations and predictive insights.', 'Learn more'],
  ['mail', 'AI Email Generator', 'Generate personalized, high-converting emails that get more replies.', 'Try it now'],
  ['chart', 'Campaign Optimizer', 'Get AI-powered suggestions to improve performance and reach your goal faster.', 'Learn more'],
  ['bot', 'AI Fundraising Coach', 'Get instant answers, ideas and guidance from your AI fundraising coach.', 'Ask anything'],
];

const steps = [
  ['Tell Us About Your Cause', 'Share a few details about your mission and fundraising goals.'],
  ['AI Analyzes & Suggests', 'Our AI analyzes data and provides customized recommendations.'],
  ['Create & Connect', 'Use AI tools to create content, emails, and connect with donors.'],
  ['Engage & Raise', 'Engage supporters with the right message at the right time.'],
  ['Optimize & Grow', 'AI continuously learns and helps you improve results over time.'],
];

export default function AiFundraisingPage() {
  return (
    <div className="pub-page">
      <section className="pub-hero ai-hero">
        <div className="pub-breadcrumb">Home <span>&gt;</span> <b>AI Fundraising</b></div>
        <div className="pub-hero-grid">
          <div className="pub-hero-copy">
            <div className="pub-badge">New <span>AI-Powered Fundraising</span></div>
            <h1>Raise More. Save Time. Powered by <em>AI.</em></h1>
            <p>CharitMe&apos;s AI tools help you create compelling campaigns, connect with the right donors, and optimize results so you can focus on making a bigger impact.</p>
            <div className="pub-actions">
              <Link href="/login?mode=signup" className="pub-btn primary">Start with AI <PublicIcon name="ai" /></Link>
              <Link href="/how-it-works" className="pub-btn secondary">See How It Works <PublicIcon name="play" /></Link>
            </div>
          </div>
          <div className="ai-console">
            <aside>{['ai', 'bot', 'chart', 'mail', 'users'].map((icon) => <span key={icon}><PublicIcon name={icon} /></span>)}</aside>
            <main>
              <h2><PublicIcon name="ai" /> AI Assistant</h2>
              <h3>Hi there!</h3>
              <p>I&apos;m here to help you create, optimize and grow your fundraising campaign.</p>
              <div className="ai-prompt-grid">
                <button><PublicIcon name="edit" /> Write a compelling campaign story</button>
                <button><PublicIcon name="users" /> Suggest a matching donor list</button>
                <button><PublicIcon name="mail" /> Create an engaging email</button>
                <button><PublicIcon name="chart" /> Analyze my campaign</button>
              </div>
              <label><input placeholder="Ask anything about your campaign..." /><PublicIcon name="arrow" /></label>
            </main>
            <div className="ai-side-card score"><b>87</b><span>Predicted Success Score</span><small>High chance of reaching your goal!</small></div>
            <div className="ai-side-card action"><span>Recommended Action</span><p>Send a follow-up email to lapsed donors</p><button>Generate Now</button></div>
            <div className="ai-side-card insight"><span>AI Insights</span><b>+ 32%</b><p>More donations expected with optimized outreach</p></div>
          </div>
        </div>
      </section>

      <section className="pub-section">
        <h2>AI Tools Built for Fundraisers Like You</h2>
        <div className="ai-tools">
          {tools.map(([icon, title, body, cta]) => (
            <article key={title}>
              <span><PublicIcon name={icon} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
              <Link href="/login?mode=signup">{cta} <PublicIcon name="arrow" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="ai-steps">
        <h2>How AI Fundraising Works</h2>
        <div>
          {steps.map(([title, body], index) => (
            <article key={title}>
              <span>{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
