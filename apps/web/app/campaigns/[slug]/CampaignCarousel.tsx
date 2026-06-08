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
        <img src={src} alt={`${title} — photo ${idx + 1}`} />
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${s}-${i}`}
              src={s}
              alt=""
              onClick={() => setIdx(i)}
              className={`pc-carousel-thumb${i === idx ? ' active' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
