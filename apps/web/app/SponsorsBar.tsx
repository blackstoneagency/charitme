'use client';

import React, { useState, useEffect } from 'react';

type Sponsor = { id: string; name: string; logo_url: string; website: string | null };

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
                <img src={s.logo_url} alt={s.name} />
              </a>
            ) : (
              <span key={`${s.id}-${i}`} className="kind-sponsor-logo" title={s.name}>
                <img src={s.logo_url} alt={s.name} />
              </span>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
