export function normalizeReceiptEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function canAccessDonationReceipt(input: {
  userId: string;
  userEmail: string | null | undefined;
  donationDonorId: string | null;
  receiptDonorId: string | null;
  receiptEmail: string | null;
}): boolean {
  const attachedOwners = [input.donationDonorId, input.receiptDonorId].filter(
    (ownerId): ownerId is string => ownerId !== null,
  );
  if (attachedOwners.some((ownerId) => ownerId !== input.userId)) return false;
  if (attachedOwners.length > 0) return true;

  const userEmail = normalizeReceiptEmail(input.userEmail);
  const receiptEmail = normalizeReceiptEmail(input.receiptEmail);
  return userEmail !== null && userEmail === receiptEmail;
}
