import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicIcon } from '../../../components/PublicIcon';

export const metadata: Metadata = {
  title: 'Start your campaign · CharitMe',
  description: 'Choose how to build your fundraiser — let AI draft it for you, or go step by step. Either way you can pause and resume anytime.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Co-equal entry for the two campaign-creation paths (CHAR-0017 gap #1).
// Both converge on the same /create wizard + /api/campaigns model:
//   • AI path      → /ai-campaign (prompt) → /create?ai=<prompt> (seeds + drafts)
//   • Guided path  → /create (step-by-step wizard)
// Theme-aware (CSS-variable colours) and mobile-first (cards stack < 720px).
// ─────────────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  flex: '1 1 300px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '28px 26px',
  borderRadius: 20,
  border: '1.5px solid var(--b1, #e8ecf4)',
  background: 'var(--s1, #fff)',
  textDecoration: 'none',
  color: 'inherit',
  boxShadow: 'var(--shadow, 0 1px 2px rgba(16,24,40,.05))',
  transition: 'border-color .15s, transform .15s',
};

function PathCard({
  href, badge, badgeBg, badgeFg, icon, iconBg, title, time, body, bullets, cta, ctaSolid,
}: {
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
}) {
  return (
    <Link href={href} style={CARD} className="cm-choose-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, background: iconBg, color: '#fff' }}>
          <PublicIcon name={icon} />
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.03em', padding: '4px 10px', borderRadius: 999, background: badgeBg, color: badgeFg }}>
          {badge}
        </span>
      </div>

      <div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 21, fontWeight: 800, color: 'var(--t1, #1a1a2e)' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--t3)' }}>{time}</p>
      </div>

      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--t2, #334064)' }}>{body}</p>

      <ul style={{ margin: '2px 0 4px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bullets.map((b) => (
          <li key={b} style={{ display: 'flex', minWidth: 0, alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: 'var(--t2, #334064)' }}>
            <span style={{ color: 'var(--green, #059669)', flexShrink: 0, marginTop: 1, width: 16, height: 16, display: 'inline-flex' }}>
              <PublicIcon name="check" />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <span
        style={{
          marginTop: 'auto',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px 18px', borderRadius: 12, fontWeight: 800, fontSize: 14.5,
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

export default function ChoosePathPage() {
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
            Two ways to launch a trusted fundraiser — both free to start. Pick whichever
            fits you; you can switch or edit anything before you publish.
          </p>
        </div>

        <div style={{ display: 'flex', minWidth: 0, flexWrap: 'wrap', gap: 18, alignItems: 'stretch' }}>
          <PathCard
            href="/ai-campaign"
            badge="FASTEST"
            badgeBg="var(--s2, #f5f0ff)"
            badgeFg="var(--violet-ink)"
            icon="ai"
            iconBg="linear-gradient(135deg,#6c35ff,#4d1ee0)"
            title="Build with AI"
            time="≈ 2 minutes"
            body="Describe your cause in a sentence. Our AI drafts your title, story, goal, and launch plan — you review, tweak, and publish."
            bullets={[
              'AI writes a compelling first draft',
              'Answer only what it still needs',
              'Edit every word before publishing',
            ]}
            cta="Build with AI"
            ctaSolid
          />
          <PathCard
            href="/create"
            badge="FULL CONTROL"
            badgeBg="var(--s3, #ecfdf5)"
            badgeFg="var(--green-dark, #047857)"
            icon="edit"
            iconBg="linear-gradient(135deg,#059669,#047857)"
            title="Step by step"
            time="≈ 10 minutes"
            body="Prefer to write it yourself? Walk through guided questions at your own pace, with full control over every detail."
            bullets={[
              'One clear question at a time',
              'Tips and examples as you go',
              'Nothing published until you say so',
            ]}
            cta="Start step by step"
            ctaSolid={false}
          />
        </div>

        <p style={{ marginTop: 22, textAlign: 'center', fontSize: 13.5, color: 'var(--t3)', display: 'flex', minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <span style={{ width: 15, height: 15, display: 'inline-flex', color: 'var(--t3)' }}><PublicIcon name="refresh" /></span>
          Your progress saves automatically — pause and resume anytime.
        </p>

        {/* AI accuracy note.
            The AI path promises "AI writes a compelling first draft" and the
            organizer is about to publish that draft under their own name, asking
            strangers for money. Saying plainly that a draft can be wrong belongs
            at the moment the path is CHOSEN, not buried in terms — a fundraiser
            that misstates a diagnosis or a cost is a trust problem for the donor
            as much as for the platform.
            Factual and low-key: this states what generated text is, and does not
            promise anything on the business's behalf. */}
        <p style={{ marginTop: 10, textAlign: 'center', fontSize: 12.5, lineHeight: 1.5, color: 'var(--t3, #64748b)', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          AI drafts are a starting point, not a finished fundraiser. They can get
          details wrong — read every line and correct anything that is not exactly
          right before you publish.
        </p>
      </section>
    </div>
  );
}
