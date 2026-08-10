'use client';

import Link from 'next/link';
import type { CSSProperties, MouseEvent } from 'react';
import { PublicIcon } from '../../components/PublicIcon';

const CARD: CSSProperties = {
  flex: '1 1 300px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '28px 26px',
  borderRadius: 8,
  border: '1.5px solid var(--b1, #e8ecf4)',
  background: 'var(--s1, #fff)',
  textDecoration: 'none',
  color: 'inherit',
  boxShadow: 'var(--shadow, 0 1px 2px rgba(16,24,40,.05))',
  transition: 'border-color .15s, transform .15s',
};

type PathCardProps = {
  href: string;
  badge: string;
  badgeBg: string;
  badgeFg: string;
  icon: string;
  iconBg: string;
  title: string;
  time: string;
  body: string;
  bullets: string[];
  cta: string;
  ctaSolid: boolean;
  onSelect?: () => void;
};

function PathCard({
  href,
  badge,
  badgeBg,
  badgeFg,
  icon,
  iconBg,
  title,
  time,
  body,
  bullets,
  cta,
  ctaSolid,
  onSelect,
}: PathCardProps) {
  const select = onSelect
    ? (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onSelect();
      }
    : undefined;

  return (
    <Link href={href} onClick={select} style={CARD} className="cm-choose-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 8, background: iconBg, color: '#fff' }}>
          <PublicIcon name={icon} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0, padding: '4px 10px', borderRadius: 999, background: badgeBg, color: badgeFg }}>
          {badge}
        </span>
      </div>

      <div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 21, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--t3)' }}>{time}</p>
      </div>

      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--t2, #334064)' }}>{body}</p>

      <ul style={{ margin: '2px 0 4px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bullets.map((bullet) => (
          <li key={bullet} style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: 'var(--t2, #334064)' }}>
            <span style={{ color: 'var(--green, #059669)', flexShrink: 0, marginTop: 1, width: 16, height: 16, display: 'inline-flex' }}>
              <PublicIcon name="check" />
            </span>
            {bullet}
          </li>
        ))}
      </ul>

      <span
        style={{
          marginTop: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 18px',
          borderRadius: 8,
          fontWeight: 800,
          fontSize: 14.5,
          background: ctaSolid ? 'var(--violet, #6c35ff)' : 'transparent',
          color: ctaSolid ? '#fff' : 'var(--violet-ink)',
          border: ctaSolid ? 'none' : '1.5px solid var(--violet, #6c35ff)',
        }}
      >
        {cta} <PublicIcon name="arrow" />
      </span>
    </Link>
  );
}

export default function CampaignPathChoice({ onGuidedStart }: { onGuidedStart?: () => void }) {
  return (
    <div className="pub-page">
      <div className="pub-breadcrumb">
        <Link href="/">Home</Link> <span>&gt;</span> <b>Start a campaign</b>
      </div>

      <section style={{ maxWidth: 820, margin: '0 auto', padding: '8px 0 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 800, color: 'var(--t1, #1a1a2e)', lineHeight: 1.15 }}>
            Start your campaign
          </h1>
          <p style={{ margin: '0 auto', maxWidth: 560, fontSize: 16, lineHeight: 1.5, color: 'var(--t2, #334064)' }}>
            Two ways to launch a trusted fundraiser. Both are free to start, save automatically, and end in the same review before publishing.
          </p>
        </div>

        <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 18, alignItems: 'stretch' }}>
          <PathCard
            href="/ai-campaign"
            badge="FASTEST"
            badgeBg="var(--s2, #f5f0ff)"
            badgeFg="var(--violet-ink)"
            icon="ai"
            iconBg="#5b21b6"
            title="Build with AI"
            time="About 3 minutes"
            body="Describe the need once. AI builds your title, story, budget, FAQs, milestones, sharing copy, and search metadata, then asks only what is missing."
            bullets={[
              'AI writes a compelling first draft',
              'Answer only what it still needs',
              'Edit every word before publishing',
            ]}
            cta="Build with AI"
            ctaSolid
          />
          <PathCard
            href="/create?path=guided"
            badge="FULL CONTROL"
            badgeBg="var(--s3, #ecfdf5)"
            badgeFg="var(--green-dark, #047857)"
            icon="edit"
            iconBg="#047857"
            title="Build Step by Step"
            time="About 8 minutes"
            body="Answer one clear question at a time, with smart defaults, inline guidance, and full control over every detail."
            bullets={[
              'One clear question at a time',
              'Tips and examples as you go',
              'Nothing published until you say so',
            ]}
            cta="Build Step by Step"
            ctaSolid={false}
            onSelect={onGuidedStart}
          />
        </div>

        <p style={{ marginTop: 22, textAlign: 'center', fontSize: 13.5, color: 'var(--t3)', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <span style={{ width: 15, height: 15, display: 'inline-flex', color: 'var(--t3)' }}><PublicIcon name="refresh" /></span>
          Your progress saves automatically. Pause and resume anytime.
        </p>

        <p style={{ marginTop: 10, textAlign: 'center', fontSize: 12.5, lineHeight: 1.5, color: 'var(--t3, #64748b)', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          AI drafts are a starting point. They can get details wrong, so review every line before publishing.
        </p>
      </section>
    </div>
  );
}
