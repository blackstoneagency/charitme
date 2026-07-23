const NON_PUBLIC_PREFIXES = [
  '/admin', '/dashboard', '/create', '/login', '/signup', '/forgot-password',
  '/profile', '/donor', '/donors', '/beneficiary', '/achievements', '/privacy-center',
  '/offline', '/go', '/events/manage', '/impact/manage', '/matching/manage', '/sponsor/manage',
];

export function normalizePublicRoute(route: string | null | undefined): string | null {
  const value = (route ?? '').trim().replace(/\/{2,}/g, '/');
  if (!value.startsWith('/') || value.length > 200 || value.includes('?') || value.includes('#')) return null;
  const normalized = value === '/' ? '/' : value.replace(/\/+$/, '');
  if (NON_PUBLIC_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) return null;
  return normalized || '/';
}

export function isPublicRoute(route: string | null | undefined): boolean {
  return normalizePublicRoute(route) !== null;
}
