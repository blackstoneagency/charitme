export const DEFAULT_MAINTENANCE_MESSAGE =
  'CharitMe is temporarily under maintenance while we make the platform better. Please check back soon.';

export type MaintenanceStatus = {
  enabled: boolean;
  message: string;
  expectedBackAt: string | null;
  supportEmail: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeMessage(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_MAINTENANCE_MESSAGE;
  const message = value.trim().slice(0, 240);
  return message || DEFAULT_MAINTENANCE_MESSAGE;
}

function safeExpectedBackAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeSupportEmail(value: unknown): string {
  if (typeof value !== 'string') return 'support@charitme.com';
  const email = value.trim().slice(0, 200);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : 'support@charitme.com';
}

export function resolveMaintenanceStatus(config: unknown): MaintenanceStatus {
  const root = record(config);
  const legacy = record(root.maintenance);
  const enabled = typeof root.maintenanceMode === 'boolean'
    ? root.maintenanceMode
    : legacy.maintenanceMode === true;

  return {
    enabled,
    message: safeMessage(root.maintenanceMessage ?? legacy.message),
    expectedBackAt: safeExpectedBackAt(root.maintenanceExpectedBackAt ?? legacy.expectedBackAt),
    supportEmail: safeSupportEmail(root.supportEmail),
  };
}

const MAINTENANCE_BYPASS_PATHS = [
  '/maintenance',
  '/offline',
  '/login',
  '/forgot-password',
  '/admin',
];

export function isMaintenanceBypassPath(path: string): boolean {
  return MAINTENANCE_BYPASS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
