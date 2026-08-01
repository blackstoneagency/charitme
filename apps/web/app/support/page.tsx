import Link from 'next/link';
import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Get help with CharitMe — search the help centre, email support, or send us a message. Every route here reaches a person.',
  alternates: { canonical: 'https://www.charitme.com/support' },
};

// Design 71 is a live-chat window with an agent avatar, typing indicator, and
// "Live Chat — Available 9AM–6PM EST".
//
// **There is no chat backend and no staffed chat rota.** A chat widget that
// looked live and answered nothing would be the single most damaging fake on the
// site: someone with a payment problem would sit waiting in a window instead of
// emailing a channel that actually reaches us. The mockup's stated hours would be
// a commitment nobody has made.
//
// So this routes to the channels that genuinely work, and states plainly that
// chat is not one of them.

const CHANNELS = [
  {
    step: 'FASTEST',
    title: 'Search the help centre',
    body: 'Most questions are already answered, and it is instant. Start here before writing to anyone — including us.',
  },
  {
    step: 'EMAIL',
    title: 'Write to support',
    body: 'Goes to a person. Include your campaign or donation reference if you have one; it roughly halves the back-and-forth.',
  },
  {
    step: 'FORM',
    title: 'Send a message',
    body: 'The contact form if you would rather not use email. Same inbox, same people.',
  },
];

const COMMON = [
  { title: 'I need a receipt', body: 'Receipts are emailed automatically. You can also download them any time from your donor area.', href: '/donor' },
  { title: 'I want a refund', body: 'What is refundable, the window, and how to ask.', href: '/refunds' },
  { title: 'My payout has not arrived', body: 'Payout timing, what can hold one up, and how to check its status.', href: '/fast-payouts' },
  { title: 'A campaign concerns me', body: 'How to report one. Reported campaigns are reviewed by a person and payouts can be paused.', href: '/trust-safety' },
  { title: 'Something is broken', body: 'Bug reports and confusing wording both help — the second kind more than you would think.', href: '/feedback' },
  { title: 'I cannot sign in', body: 'Password reset and account recovery.', href: '/forgot-password' },
];

export default function SupportPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="SUPPORT"
        title="How can we help?"
        lede="Three ways to reach us, all of which end up in front of a person. Start with the help centre — it is instant, and it usually has the answer."
        actions={
          <>
            <Link href="/help" className="kind-start-pill" style={{ display: 'inline-flex' }}>
              Search the help centre
            </Link>
            <Link
              href="/contact"
              style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', borderRadius: 'var(--r)', border: '1px solid var(--b2)', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}
            >
              Send a message
            </Link>
          </>
        }
      />

      <Section id="channels" heading="Ways to reach us">
        <CardGrid min={280}>
          {CHANNELS.map((c) => <InfoCard key={c.step} step={c.step} title={c.title} body={c.body} />)}
        </CardGrid>
        <p style={{ fontSize: '14px', color: 'var(--t3)', marginTop: '16px' }}>
          Email:{' '}
          <a href="mailto:support@charitme.com" style={{ color: 'var(--green-text)', fontWeight: 700 }}>
            support@charitme.com
          </a>
          {' · '}
          <Link href="/contact" style={{ color: 'var(--green-text)', fontWeight: 700 }}>contact form</Link>
        </p>
      </Section>

      <Section id="common" heading="The things people ask most" intro="Each of these has a page that answers it properly.">
        <CardGrid min={250}>
          {COMMON.map((c) => <InfoCard key={c.href} title={c.title} body={c.body} href={c.href} />)}
        </CardGrid>
      </Section>

      <Section id="no-chat" heading="Is there live chat?">
        <div style={{ padding: '22px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: '700px' }}>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, margin: 0 }}>
            <strong style={{ color: 'var(--t1)' }}>No — not yet.</strong> We would rather tell you that
            than put a chat bubble in the corner that looks live and answers nothing. If you have a
            payment problem, sitting in a chat window waiting for an agent who is not there is worse
            than emailing a channel that actually reaches us.
          </p>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, marginTop: '12px' }}>
            Email and the contact form both go to a real inbox that people read. If chat ships, it
            will appear here with the hours it is genuinely staffed.
          </p>
        </div>
      </Section>

      <CtaBand
        heading="Still stuck?"
        body="Tell us what happened and where you were on the site. We read every message."
        primary={{ label: 'Contact us', href: '/contact' }}
        secondary={{ label: 'Send feedback', href: '/feedback' }}
      />
    </PageBody>
  );
}
