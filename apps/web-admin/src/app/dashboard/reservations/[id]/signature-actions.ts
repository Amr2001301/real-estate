'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';
import { getLetterhead } from '@/lib/letterhead';
import { getLocale } from '@/lib/locale';
import { getDocumentTemplates, getPrintSettings, pickTemplate } from '@/lib/print-settings';
import { reservationSnapshot } from '@/lib/sign-snapshot';
import type { Reservation } from '@/lib/types';

export type SignatureActionResult = { ok: true; url?: string } | { ok: false; error: string };

/**
 * Sends the booking form for the customer's signature: the form is laid out
 * here, as it prints (the company's default booking wording included), and
 * the API keeps it as sent. The link is only shown now.
 */
export async function requestSignatureAction(reservationId: string): Promise<SignatureActionResult> {
  try {
    const [r, letterhead, paper, templates, locale] = await Promise.all([
      api.get<Reservation>(`/reservations/${reservationId}`),
      getLetterhead(),
      getPrintSettings(),
      getDocumentTemplates('RESERVATION'),
      getLocale(),
    ]);
    const snapshot = reservationSnapshot(r, letterhead, paper, pickTemplate(templates, null), locale);
    const res = await api.post<{ url: string }>(`/reservations/${reservationId}/signature-requests`, { snapshot });
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
