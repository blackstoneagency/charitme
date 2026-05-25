export function getAppOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function getAuthCallbackUrl(): string {
  return `${getAppOrigin()}/api/auth/callback`;
}

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return '/';
  try {
    const url = new URL(raw, 'http://localhost');
    if (url.host !== 'localhost') return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}
