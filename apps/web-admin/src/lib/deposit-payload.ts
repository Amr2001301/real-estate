import { wallTimeToIso } from './zoned-time';

/**
 * The POST /deposits body from a payment form: the "تسجيل دفعة" page and the
 * per-row "سجّل دفعة" on the contract page send the same fields, so a row
 * recorded from either has its payment method (and a cheque is tracked until
 * it clears).
 */
export function depositPayload(
  formData: FormData,
  ids: { contractId: string; installmentId?: string },
  timeZone: string,
) {
  const str = (k: string) => String(formData.get(k) ?? '').trim() || undefined;
  const paymentMethod = str('paymentMethod');
  const paidAt = str('paidAt');
  return {
    contractId: ids.contractId,
    installmentId: ids.installmentId,
    amount: Number(formData.get('amount') ?? 0),
    // Typed in the company's time, not the API server's.
    paidAt: paidAt ? wallTimeToIso(paidAt, timeZone) : undefined,
    receiptUrl: str('receiptUrl'),
    paymentMethod,
    cheque:
      paymentMethod === 'CHEQUE'
        ? {
            chequeNumber: str('chequeNumber'),
            drawerBankName: str('drawerBankName'),
            chequeDueDate: str('chequeDueDate'),
          }
        : undefined,
    transfer:
      paymentMethod === 'BANK_TRANSFER' && (str('transferBank') || str('transferRef'))
        ? { bankName: str('transferBank'), referenceNumber: str('transferRef') }
        : undefined,
  };
}
