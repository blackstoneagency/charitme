'use client';

import React, { useState } from 'react';
import { getCoverForCategory, getCoverForCampaign } from '../lib/photo-catalog';

/**
 * Campaign cover <img> that never renders broken. If the stored `src` fails to
 * load (dead/removed URL), it falls back to a verified free-to-use Unsplash
 * photo for the category; if that also fails, to a neutral gradient. This keeps
 * every campaign image "100% working in production" regardless of stored data.
 */
export default function CampaignImage({
  src,
  category,
  campaignKey,
  alt,
  className,
  width,
  height,
  loading = 'lazy',
  fetchPriority,
}: {
  src: string | null | undefined;
  category: string | null;
  /** Stable per-campaign key (slug/id) so the fallback varies within a category. */
  campaignKey?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const fallback = campaignKey
    ? getCoverForCampaign(category, campaignKey)
    : getCoverForCategory(category);
  const initial = src && src.startsWith('http') ? src : fallback;
  const [current, setCurrent] = useState(initial);
  const [stage, setStage] = useState<0 | 1 | 2>(initial === fallback ? 1 : 0);

  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions
    <img
      src={current}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      {...(fetchPriority ? { fetchPriority } : {})}
      onError={() => {
        if (stage === 0) { setStage(1); setCurrent(fallback); }
        else if (stage === 1) {
          setStage(2);
          // 1×1 transparent pixel; container shows its own background.
          setCurrent('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Crect width=%2216%22 height=%2216%22 fill=%22%23e6e9f2%22/%3E%3C/svg%3E');
        }
      }}
    />
  );
}
