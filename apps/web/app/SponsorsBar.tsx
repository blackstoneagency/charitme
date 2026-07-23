'use client';

import React, { useState, useEffect } from 'react';

type Sponsor = { id: string; name: string; logo_url: string | null; website: string | null };

function extractDomain(urlOrDomain: string): string {
  try {
    const u = urlOrDomain.startsWith('http') ? new URL(urlOrDomain) : new URL('https://' + urlOrDomain);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return urlOrDomain.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

function googleLogoUrl(domain: string, size = 128) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

function SponsorImg({ src, website, name }: { src: string | null; website: string | null; name: string }) {
  const domain = website ? extractDomain(website) : null;
  const fallback = domain ? googleLogoUrl(domain, 128) : null;
  const [errorCount, setErrorCount] = useState(0);

  const candidates = [src, fallback].filter((u): u is string => Boolean(u));
  const imgSrc = errorCount < candidates.length ? candidates[errorCount] : null;

  if (!imgSrc) {
    return <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>{name.slice(0, 2).toUpperCase()}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions
    <img src={imgSrc} alt={name} onError={() => setErrorCount(c => c + 1)} />
  );
}

export default function SponsorsBar() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    fetch('/api/sponsors')
      .then(r => r.ok ? r.json() : { sponsors: [] })
      .then((d: { sponsors?: Sponsor[] }) => setSponsors(d.sponsors ?? []))
      .catch(() => {});
  }, []);

  if (sponsors.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly
  const items = [...sponsors, ...sponsors];

  return (
    <div className="kind-sponsors-wrap">
      <span className="kind-sponsors-label">Our Sponsors</span>
      <div className="kind-sponsors-track-wrap">
        <div className="kind-sponsors-track">
          {items.map((s, i) => (
            s.website ? (
              <a key={`${s.id}-${i}`} href={s.website} target="_blank" rel="noopener noreferrer" className="kind-sponsor-logo" title={s.name}>
                <SponsorImg key={`${s.logo_url ?? ''}-${i}`} src={s.logo_url} website={s.website} name={s.name} />
              </a>
            ) : (
              <span key={`${s.id}-${i}`} className="kind-sponsor-logo" title={s.name}>
                <SponsorImg key={`${s.logo_url ?? ''}-${i}`} src={s.logo_url} website={s.website} name={s.name} />
              </span>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
