'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/locale';
import { portalReservationsContractsT } from '@/messages/portal/reservations-contracts';
import type { PortalReservation } from '@/lib/types';

export interface PortalReservationFormState {
  error?: string;
}

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export async function createPortalReservationAction(
  _prev: PortalReservationFormState,
  formData: FormData,
): Promise<PortalReservationFormState> {
  const m = portalReservationsContractsT(await getLocale()).reservations.actions;
  const leadId = str(formData, 'leadId');
  const unitId = str(formData, 'unitId');
  if (!leadId) return { error: m.leadRequired };
  if (!unitId) return { error: m.unitRequired };

  const payload = {
    leadId,
    unitId,
    installmentPlanTemplateId: str(formData, 'installmentPlanTemplateId'),
    selectedDurationOptionId: str(formData, 'selectedDurationOptionId'),
    notes: str(formData, 'notes'),
  };

  let created: PortalReservation;
  try {
    created = await api.post<PortalReservation>('/portal/reservations', payload);
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/portal/reservations');
  revalidatePath('/portal/activity');
  revalidatePath('/portal');
  redirect(`/portal/reservations/${created.id}`);
}
