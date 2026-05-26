import Link from 'next/link';
import type React from 'react';

const FEATURES = [
  { icon: 'edit', title: 'AI Campaign Builder', body: 'Create a powerful campaign in minutes with our AI assistant.', tone: 'violet' },
  { icon: 'rocket', title: 'AI Growth Engine', body: 'Our AI finds your ideal donors and grows your campaign automatically.', tone: 'green' },
  { icon: 'shield', title: 'AI Trust & Safety', body: 'Advanced verification protects donors and builds trust from day one.', tone: 'blue' },
  { icon: 'chart', title: 'AI Optimization', body: 'Real-time insights and AI recommendations to maximize your results.', tone: 'orange' },
  { icon: 'heart', title: 'AI Impact Updates', body: 'Automatically share updates and show donors the real world impact.', tone: 'pink' },
];

const STATS = [
  ['$2.8B+', 'Raised on KindFund'],
  ['8M+', 'Successful Campaigns'],
  ['50M+', 'Donors Worldwide'],
  ['98%', 'Trust Score Average'],
  ['195', 'Countries Supported'],
];

const TESTIMONIALS = [
  {
    quote: "KindFund's AI helped us raise 3x more than we ever thought possible. The support was incredible.",
    name: 'James R.',
    role: 'Father & Organizer',
    raised: '$78,543',
    image: 'linear-gradient(135deg, #8b5cf6, #f59e0b)',
  },
  {
    quote: 'The transparency and updates kept our donors engaged the entire way. Best experience ever.',
    name: 'Melissa K.',
    role: 'Nonprofit Director',
    raised: '$120,890',
    image: 'linear-gradient(135deg, #10b981, #f472b6)',
  },
  {
    quote: "The AI Growth Engine found donors I didn't even know existed. Game changer.",
    name: 'David L.',
    role: 'Community Leader',
    raised: '$56,230',
    image: 'linear-gradient(135deg, #0f172a, #06b6d4)',
  },
];

const PRESS = ['Forbes', 'FAST COMPANY', 'TC TechCrunch', 'The New York Times', 'USA TODAY'];

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    sparkle: <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    rocket: <><path d="M4.5 16.5c-1.1 1.1-1.5 3-1.5 3s1.9-.4 3-1.5c.6-.6.7-1.5.2-2.1-.5-.5-1.4-.4-1.7.6Z" /><path d="M9 15l-2-2a16 16 0 0 1 8-9 5 5 0 0 1 5 5 16 16 0 0 1-9 8l-2-2Z" /><path d="M15 9h.01" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    play: <path d="M9 7l8 5-8 5V7Z" />,
    check: <path d="M20 6L9 17l-5-5" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export default function HomePage() {
  return (
    <div className="kind-page">
      <section className="kind-hero">
        <div className="container kind-hero-grid">
          <div className="kind-hero-copy">
            <div className="kind-badge"><Icon name="sparkle" className="h-4 w-4" /> The World&apos;s #1 AI Fundraising Platform</div>
            <h1>
              Fundraising that <span>thinks</span> for you.
            </h1>
            <div className="kind-scribble" aria-hidden="true" />
            <p>Create, grow, and succeed with the power of AI.<br />More trust. More donors. More impact.</p>
            <div className="kind-actions">
              <Link href="/create" className="kind-btn kind-btn-primary">Start Your Fundraiser</Link>
              <Link href="/how-it-works" className="kind-btn kind-btn-secondary">See How It Works <span><Icon name="play" className="h-3.5 w-3.5" /></span></Link>
            </div>
            <div className="kind-pills">
              {['AI Campaign Builder', 'AI Growth Engine', 'AI Trust & Safety', '24/7 AI Support'].map((item, index) => (
                <div key={item}><Icon name={index === 0 ? 'sparkle' : index === 1 ? 'rocket' : index === 2 ? 'shield' : 'users'} className="h-3.5 w-3.5" />{item}</div>
              ))}
            </div>
            <div className="kind-proof">
              <span>Trusted by millions</span>
              <div className="kind-avatar-stack">
                {[0, 1, 2, 3, 4].map((i) => <i key={i} />)}
              </div>
              <strong>★★★★★</strong>
              <span>4.9/5 from 50,000+ reviews</span>
            </div>
          </div>

          <div className="kind-hero-art">
            <div className="kind-photo" />
            <div className="kind-floating kind-floating-1"><Icon name="shield" /><div><span>Trust Score</span><strong>98</strong><small>Excellent</small></div></div>
            <div className="kind-floating kind-floating-2"><Icon name="users" /><div><strong>487</strong><span>Donors</span></div></div>
            <div className="kind-floating kind-floating-3"><Icon name="chart" /><div><strong>2.4K</strong><span>Shares</span></div></div>
            <div className="kind-floating kind-floating-4"><Icon name="clock" /><div><strong>Real-time</strong><span>Impact Updates</span></div></div>
            <div className="kind-campaign-card">
              <div className="kind-verified"><Icon name="check" className="h-3.5 w-3.5" /> VERIFIED CAMPAIGN</div>
              <h2>Help Mia Get Life-Saving Heart Surgery</h2>
              <p>Organized by Sarah Thompson <b /></p>
              <div className="kind-raise-row"><strong>$24,350 <span>raised</span></strong><span>$50,000 goal</span></div>
              <div className="kind-progress"><i /></div>
              <div className="kind-raise-row kind-small"><span>487 donations</span><span>32 days left</span></div>
              <Link href="/campaigns" className="kind-donate"><Icon name="heart" className="h-4 w-4" /> Donate Now</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="kind-section kind-ai">
        <div className="container">
          <h2>AI Works. You Win.</h2>
          <div className="kind-feature-grid">
            {FEATURES.map((feature) => (
              <article className="kind-feature" key={feature.title}>
                <div className={`kind-icon kind-icon-${feature.tone}`}><Icon name={feature.icon} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <Link href="/features">Learn more <Icon name="arrow" className="h-3.5 w-3.5" /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container kind-stats">
        {STATS.map(([value, label]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </section>

      <section className="kind-section kind-trust">
        <div className="container kind-trust-grid">
          <div>
            <span className="kind-eyebrow">More than a platform</span>
            <h2>A movement powered<br />by trust and technology.</h2>
            <p>We combine human compassion with artificial intelligence to help more people succeed and more good happen in the world.</p>
            <ul>
              {['Industry-leading Trust Score', 'Real-time fraud detection', 'Bank-level security', 'Transparent impact tracking'].map((item) => (
                <li key={item}><Icon name="check" className="h-3 w-3" /> {item}</li>
              ))}
            </ul>
            <Link href="/trust-safety">Our Trust Promise <Icon name="arrow" className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="kind-testimonials">
            {TESTIMONIALS.map((item) => (
              <article key={item.name}>
                <div className="kind-quote">&quot;</div>
                <p>{item.quote}</p>
                <div className="kind-person">
                  <i style={{ background: item.image }} />
                  <div><strong>{item.name}</strong><span>{item.role}</span><b>Raised {item.raised}</b></div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="container kind-press">
          {PRESS.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="container kind-future">
        <div className="kind-future-bg" />
        <div className="kind-future-copy">
          <h2>The future of fundraising<br />is intelligent.</h2>
          <p>KindFund&apos;s AI works behind the scenes so you can focus on what matters most - your mission.</p>
        </div>
        <div className="kind-orbits">
          {[
            ['sparkle', 'Smarter Campaigns', 'AI creates and optimizes for maximum impact.'],
            ['users', 'Stronger Connections', 'AI matches you with the right supporters.'],
            ['heart', 'Bigger Impact', 'AI helps you change more lives.'],
          ].map(([icon, title, body], i) => (
            <article key={title}>
              <div className={i === 1 ? 'green' : i === 2 ? 'orange' : ''}><Icon name={icon} /></div>
              <strong>{title}</strong>
              <span>{body}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="container kind-cta">
        <div>
          <h2>Ready to turn your story into impact?</h2>
          <p>Join millions of fundraisers who are reaching their goals with AI.</p>
        </div>
        <div>
          <Link href="/create" className="kind-btn kind-btn-white">Start Your Fundraiser</Link>
          <Link href="/contact" className="kind-btn kind-btn-outline">Talk to an Expert</Link>
        </div>
      </section>
    </div>
  );
}
