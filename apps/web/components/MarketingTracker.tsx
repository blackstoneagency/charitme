'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MARKETING_OPT_OUT_STORAGE_KEY } from '../lib/marketing-consent';

const VISITOR_STORAGE_KEY = 'charitme-visitor-id';
const PRIVATE_PREFIXES = [
  '/admin', '/dashboard', '/create', '/login', '/signup', '/forgot-password',
  '/profile', '/donor', '/donors', '/beneficiary', '/privacy-center', '/offline',
];

function isTrackablePath(pathname: string): boolean {
  return !PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function getVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export default function MarketingTracker(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    if (!isTrackablePath(pathname)) return;
    if (window.localStorage.getItem(MARKETING_OPT_OUT_STORAGE_KEY) === 'true') return;

    const params = new URLSearchParams(query);
    const payload = {
      visitorId: getVisitorId(),
      event: pathname.startsWith('/campaigns/') ? 'campaign_viewed' : pathname === '/' ? 'landing_page_viewed' : 'page_viewed',
      url: window.location.href,
      referrer: document.referrer || undefined,
      utmSource: params.get('utm_source') ?? undefined,
      utmMedium: params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
      utmTerm: params.get('utm_term') ?? undefined,
      utmContent: params.get('utm_content') ?? undefined,
    };

    void fetch('/api/marketing/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, query]);

  return null;
}
