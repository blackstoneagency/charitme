export const DEFAULT_SIGNED_IN_PATH = '/dashboard';

export function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function getAuthCallbackUrl(): string {
  if (typeof window !== 'undefined') return `${window.location.origin}/api/auth/callback`;
  return `${getAppOrigin()}/api/auth/callback`;
}

export function safeNextPath(raw: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, 'http://localhost');
    if (url.host !== 'localhost') return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
