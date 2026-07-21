'use client';

import React, { useState, useCallback } from 'react';

export default function CampaignCarousel({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [idx, setIdx] = useState(0);
  const total = images.length;

  const prev = useCallback(() => setIdx(i => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx(i => (i + 1) % total), [total]);

  if (total === 0) return null;

  const src = images[idx];

  return (
    <div className="pc-carousel">
      {/* Main image */}
      <div className="pc-carousel-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${title} — ${idx + 1}`} />
        {total > 1 && (
          <>
            <button
              className="pc-carousel-btn pc-carousel-prev"
              onClick={prev}
              aria-label="Previous photo"
              type="button"
            >
              ‹
            </button>
            <button
              className="pc-carousel-btn pc-carousel-next"
              onClick={next}
              aria-label="Next photo"
              type="button"
            >
              ›
            </button>
            <span className="pc-carousel-counter">{idx + 1} / {total}</span>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="pc-carousel-thumbs">
          {images.map((s, i) => (
            <button
              key={`${s}-${i}`}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Show ${title} image ${i + 1}`}
              aria-current={i === idx}
              className={`pc-carousel-thumb${i === idx ? ' active' : ''}`}
              style={{ padding: 0, background: 'none' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
