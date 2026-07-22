export function parseCampaignPage(value: string | null, fallback = 1): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseCampaignLimit(value: string | null, fallback = 24): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : fallback;
}

export function sanitizeCampaignSearchTerm(value: string): string {
  return value.replace(/[,()]/g, ' ').trim().slice(0, 120);
}
