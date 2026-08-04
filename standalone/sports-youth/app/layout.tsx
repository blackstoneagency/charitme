import type { Metadata } from 'next';
import './globals.css';

const TITLE = 'Sports & Youth Fundraisers';
const DESC = 'Teams, clubs and young athletes raising for gear, travel and season fees. Building champions. Building futures.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL('https://www.charitme.com'),
  alternates: { canonical: '/causes/sports-youth' },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: '/causes/sports-youth',
    type: 'website',
    siteName: 'CharitMe',
    // Explicit: declaring openGraph without `images` makes Next drop the
    // file-convention image, and the page then shares as a blank card.
    images: [{ url: '/opengraph-image' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Keyboard users get past the header without tabbing every nav link. */}
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
