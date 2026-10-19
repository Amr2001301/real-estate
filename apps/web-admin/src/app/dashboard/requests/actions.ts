'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api';

export interface InquiryActionState {
  error?: string;
}

/** FG-04 — OPEN → RESPONDED → CLOSED (or OPEN → CLOSED). */
export async function setInquiryStatusAction(
  id: string,
  status: 'RESPONDED' | 'CLOSED',
): Promise<InquiryActionState> {
  try {
    await api.patch(`/info-requests/${id}`, { status });
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/requests');
  return {};
}
