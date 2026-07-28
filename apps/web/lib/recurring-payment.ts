export type RecurringRenewalAmounts = {
  donationAmountCents: number;
  tipCents: number;
};

type RecurringRenewalInput = {
  invoiceAmountPaid: number;
  metadataDonationAmount?: string;
  metadataTipAmount?: string;
  storedDonationAmount?: number | null;
  storedTipAmount?: number | null;
};

function parseCents(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const cents = Number(value);
  return Number.isSafeInteger(cents) ? cents : null;
}

function allocateKnownSplit(
  invoiceAmountPaid: number,
  donationAmountCents: number,
  tipCents: number,
): RecurringRenewalAmounts {
  const expectedAmount = donationAmountCents + tipCents;
  if (expectedAmount <= 0 || invoiceAmountPaid > expectedAmount) {
    throw new Error('Recurring invoice amount exceeds the configured donation and tip.');
  }

  if (invoiceAmountPaid === expectedAmount) {
    return { donationAmountCents, tipCents };
  }

  const allocatedTip = Math.round((invoiceAmountPaid * tipCents) / expectedAmount);
  return {
    donationAmountCents: invoiceAmountPaid - allocatedTip,
    tipCents: allocatedTip,
  };
}

export function resolveRecurringRenewalAmounts(
  input: RecurringRenewalInput,
): RecurringRenewalAmounts {
  if (!Number.isSafeInteger(input.invoiceAmountPaid) || input.invoiceAmountPaid <= 0) {
    throw new Error('Recurring invoice must contain a positive integer amount.');
  }

  const metadataDonationAmount = parseCents(input.metadataDonationAmount);
  const metadataTipAmount = parseCents(input.metadataTipAmount);
  if (metadataDonationAmount !== null && metadataTipAmount !== null) {
    if (metadataDonationAmount <= 0) {
      throw new Error('Recurring donation metadata must contain a positive principal amount.');
    }
    return allocateKnownSplit(
      input.invoiceAmountPaid,
      metadataDonationAmount,
      metadataTipAmount,
    );
  }

  const storedDonationAmount = input.storedDonationAmount;
  if (
    storedDonationAmount === null
    || storedDonationAmount === undefined
    || !Number.isSafeInteger(storedDonationAmount)
    || storedDonationAmount <= 0
  ) {
    throw new Error('Recurring donation principal could not be resolved.');
  }

  const storedTipAmount = input.storedTipAmount ?? 0;
  if (!Number.isSafeInteger(storedTipAmount) || storedTipAmount < 0) {
    throw new Error('Recurring donation tip could not be resolved.');
  }

  if (storedTipAmount > 0) {
    return allocateKnownSplit(
      input.invoiceAmountPaid,
      storedDonationAmount,
      storedTipAmount,
    );
  }

  const donationAmountCents = Math.min(input.invoiceAmountPaid, storedDonationAmount);
  return {
    donationAmountCents,
    tipCents: input.invoiceAmountPaid - donationAmountCents,
  };
}
