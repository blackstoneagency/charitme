import type { Metadata } from 'next';
import { PageBody, PageHero, Section, CardGrid, InfoCard, CtaBand } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'CharitMe on Mobile',
  description:
    'Use CharitMe on your phone — install it from your browser in two taps. Give, track your impact, and manage campaigns anywhere.',
  alternates: { canonical: 'https://www.charitme.com/mobile-app' },
};

// The design shows App Store and Google Play badges. Those are NOT reproduced:
// there is no native app. `footerSettings.appStoreUrl` and `googlePlayUrl` ship
// empty for exactly this reason, and AppShell already omits the whole badge row
// rather than link a badge that goes nowhere. Advertising a store listing that
// does not exist is the clearest possible unsupported claim.
//
// What IS true is that the site is an installable PWA — `app/manifest.ts` sets
// `display: standalone`, and `InstallPrompt` + `PWARegister` are mounted in the
// root layout. So this page documents the thing that actually works today.

const INSTALL = [
  {
    step: 'IPHONE / IPAD',
    title: 'Add to Home Screen in Safari',
    body: 'Open charitme.com in Safari, tap the Share button, then “Add to Home Screen”. CharitMe opens full-screen from your home screen, with no browser chrome.',
  },
  {
    step: 'ANDROID',
    title: 'Install from Chrome',
    body: 'Open charitme.com in Chrome and tap “Install app” in the menu, or accept the prompt when it appears. It behaves like any other installed app.',
  },
  {
    step: 'DESKTOP',
    title: 'Install from your browser',
    body: 'Chrome and Edge both offer an install icon in the address bar. Useful if you manage campaigns and want CharitMe in its own window.',
  },
];

const WHAT_YOU_GET = [
  { title: 'Works offline', body: 'A service worker caches the app shell, so a page you have already visited still opens without a connection. Donations still need one.' },
  { title: 'Full screen, no browser bar', body: 'Installed, CharitMe runs standalone — the same screen space a native app gets.' },
  { title: 'Always current', body: 'There is no update to download. You get the current version every time you open it, which is the main advantage over a native app.' },
  { title: 'Nothing extra to trust', body: 'No app-store account, no additional permissions, no separate binary. It is the same site you already use.' },
];

export default function MobileAppPage() {
  return (
    <PageBody>
      <PageHero
        eyebrow="MOBILE"
        title="CharitMe on your phone"
        lede="There is no separate app to download. CharitMe installs directly from your browser in two taps, then behaves like any other app on your home screen."
      />

      <Section id="install" heading="How to install it" intro="Two taps on any platform. Nothing to download from a store.">
        <CardGrid min={280}>
          {INSTALL.map((i) => <InfoCard key={i.step} step={i.step} title={i.title} body={i.body} />)}
        </CardGrid>
      </Section>

      <Section id="what" heading="What you get">
        <CardGrid min={250}>
          {WHAT_YOU_GET.map((w) => <InfoCard key={w.title} title={w.title} body={w.body} />)}
        </CardGrid>
      </Section>

      <Section id="native" heading="What about the App Store?">
        <div style={{ padding: '22px', border: '1px solid var(--b1)', borderRadius: 'var(--rl)', background: 'var(--s2)', maxWidth: '680px' }}>
          <p style={{ fontSize: '15px', color: 'var(--t3)', lineHeight: 1.65, margin: 0 }}>
            <strong style={{ color: 'var(--t1)' }}>There are no native iOS or Android apps yet.</strong>{' '}
            We would rather say that plainly than show store badges that go nowhere. If native apps
            ship, they will be listed here and linked from the footer — and until then the
            installable version above is the whole mobile experience, not a stopgap.
          </p>
        </div>
      </Section>

      <CtaBand
        heading="Try it now"
        body="Open CharitMe on your phone and install it from the browser menu — it takes about ten seconds."
        primary={{ label: 'Browse campaigns', href: '/campaigns' }}
        secondary={{ label: 'How it works', href: '/how-it-works' }}
      />
    </PageBody>
  );
}
