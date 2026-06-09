'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicIcon } from '../../components/PublicIcon';

const POPULAR_REQUESTS = [
  ['heart', 'Medical fundraiser', 'for a loved one'],
  ['shield', 'Emergency relief', 'fund right now'],
  ['users', 'Memorial fund', 'for my community'],
  ['globe', 'Nonprofit campaign', 'for my cause'],
  ['dollar', 'Education fundraiser', 'for tuition or school'],
] as const;

export default function AiCampaignPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

  const start = () => {
    const q = prompt.trim();
    router.push(q ? `/create?ai=${encodeURIComponent(q)}` : '/create');
  };

  return (
    <div className="pub-page ai-builder-page">
      <div className="pub-breadcrumb">
        <Link href="/">Home</Link> <span>&gt;</span> <b>AI Campaign Builder</b>
      </div>

      <section className="ai-builder-card">
        <div className="ai-builder-orb">
          <span className="ai-builder-spark s1" />
          <span className="ai-builder-spark s2" />
          <span className="ai-builder-spark s3" />
          <span className="ai-builder-spark s4" />
          <span className="ai-builder-spark s5" />
          <div className="ai-builder-orb-circle"><PublicIcon name="ai" /></div>
        </div>

        <h2 className="ai-builder-greeting">Hi! I&apos;m your <em>AI Concierge.</em></h2>
        <p className="ai-builder-sub">
          I&apos;ll help you build the perfect fundraising campaign for your cause.<br />
          Tell me about your cause and I&apos;ll recommend the best campaign setup for you.
        </p>

        <div className="ai-builder-divider"><span><PublicIcon name="ai" /></span></div>

        <div className="ai-builder-input">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you're looking for..."
            rows={3}
          />
          <p className="ai-builder-examples">
            Examples: &ldquo;Medical fundraiser for my mom&apos;s surgery&rdquo;, &ldquo;Emergency relief after a house fire&rdquo;,
            &ldquo;Memorial fund for my brother&rdquo;, &ldquo;Scholarship fund for my school&rdquo;
          </p>
          <button type="button" onClick={start} aria-label="Start building my campaign">
            <PublicIcon name="arrow" />
          </button>
        </div>

        <h3 className="ai-builder-popular">Popular requests</h3>
        <div className="ai-builder-chips">
          {POPULAR_REQUESTS.map(([icon, title, sub]) => (
            <button key={title} type="button" onClick={() => setPrompt(`${title} ${sub}`)}>
              <PublicIcon name={icon} />
              <span>
                {title}<br />{sub}
              </span>
            </button>
          ))}
        </div>

        <p className="ai-builder-secure"><PublicIcon name="lock" /> Your information is secure and never shared.</p>
      </section>
    </div>
  );
}
