export type SupabaseColumnError = { code?: string; message?: string } | null;

export function isMissingPaymentMethodsColumn(error: SupabaseColumnError): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return error.code === 'PGRST204'
    || error.code === '42703'
    || (message.includes('payment_methods') && (message.includes('column') || message.includes('schema cache')));
}
