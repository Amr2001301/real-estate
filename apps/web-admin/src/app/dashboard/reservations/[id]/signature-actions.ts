'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/locale';

export type SignatureActionResult = { ok: true; url?: string } | { ok: false; error: string };

/**
 * Sends the booking form for the customer's signature. The API lays the form
 * out as it prints (the company's default booking wording and paper form
 * included) and keeps it as sent; it is written in the dashboard's language.
 * The link is only shown now.
 */
export async function requestSignatureAction(reservationId: string): Promise<SignatureActionResult> {
  try {
    const locale = await getLocale();
    const res = await api.post<{ url: string }>(`/reservations/${reservationId}/signature-requests`, { locale });
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    return { ok: true, url: res.url };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: (e as Error).message };
  }
}

export async function cancelSignatureAction(reservationId: string, requestId: string): Promise<SignatureActionResult> {
  try {
    await api.delete(`/signature-requests/${requestId}`);
    revalidatePath(`/dashboard/reservations/${reservationId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: (e as Error).message };
  }
}
