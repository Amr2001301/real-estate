'use server';

import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { api } from '@/lib/api';

export interface ListingFormState {
  error?: string;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** The form as the API takes it: blank optional fields are left out on create and cleared on edit. */
function payload(f: FormData, editing: boolean) {
  const text = (k: string) => str(f, k) || (editing ? null : undefined);
  const num = (k: string) => {
    const v = str(f, k);
    return v === '' ? (editing ? null : undefined) : Number(v);
  };
  const kind = str(f, 'kind');
  return {
    ...(editing ? {} : { kind }),
    title: str(f, 'title'),
    unitType: str(f, 'unitType'),
    city: str(f, 'city'),
    district: text('district'),
    compound: text('compound'),
    address: text('address'),
    developerName: text('developerName'),
    projectName: text('projectName'),
    area: Number(str(f, 'area')),
    bedrooms: num('bedrooms'),
    bathrooms: num('bathrooms'),
    floor: num('floor'),
    finishing: text('finishing'),
    view: text('view'),
    price: Number(str(f, 'price')),
    // A rent has no down payment: the field is not on its form.
    downPayment: num('downPayment'),
    deliveryDate: text('deliveryDate'),
    description: text('description'),
    ownerName: text('ownerName'),
    ownerPhone: text('ownerPhone'),
    agentId: text('agentId'),
    // BRK-5: only a primary sale's form has the project picker.
    ...(f.has('developerProjectId') ? { developerProjectId: text('developerProjectId') } : {}),
    photos: f.getAll('photos').map(String).filter(Boolean),
  };
}

export async function createListingAction(_prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  let id: string;
  try {
    id = (await api.post<{ id: string }>('/listings', payload(formData, false))).id;
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/listings');
  redirect(`/dashboard/listings/${id}`);
}

export async function updateListingAction(id: string, _prev: ListingFormState, formData: FormData): Promise<ListingFormState> {
  try {
    await api.patch(`/listings/${id}`, payload(formData, true));
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath('/dashboard/listings');
  revalidatePath(`/dashboard/listings/${id}`);
  redirect(`/dashboard/listings/${id}`);
}

export async function setListingStatusAction(id: string, formData: FormData): Promise<void> {
  await api.patch(`/listings/${id}/status`, { status: str(formData, 'status') });
  revalidatePath('/dashboard/listings');
  revalidatePath(`/dashboard/listings/${id}`);
}

export async function deleteListingAction(id: string): Promise<void> {
  await api.delete(`/listings/${id}`);
  revalidatePath('/dashboard/listings');
  redirect('/dashboard/listings');
}

// ─── Mandates and tenancies ────────────────────────────────────────────────

async function termsCall(listingId: string, call: () => Promise<unknown>): Promise<ListingFormState> {
  try {
    await call();
  } catch (e) {
    unstable_rethrow(e);
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/listings/${listingId}`);
  revalidatePath('/dashboard');
  return {};
}

export async function createMandateAction(listingId: string, _prev: ListingFormState, f: FormData): Promise<ListingFormState> {
  const value = Number(str(f, 'commissionValue'));
  const byPct = str(f, 'commissionMode') !== 'AMOUNT';
  return termsCall(listingId, () =>
    api.post(`/listings/${listingId}/mandates`, {
      kind: str(f, 'kind'),
      ...(byPct ? { commissionPct: value } : { commissionAmount: value }),
      startDate: str(f, 'startDate'),
      endDate: str(f, 'endDate'),
      notes: str(f, 'notes') || undefined,
    }),
  );
}

export async function cancelMandateAction(listingId: string, mandateId: string): Promise<void> {
  await termsCall(listingId, () => api.post(`/listings/mandates/${mandateId}/cancel`, {}));
}

export async function createTenancyAction(listingId: string, _prev: ListingFormState, f: FormData): Promise<ListingFormState> {
  const deposit = str(f, 'deposit');
  const res = await termsCall(listingId, () =>
    api.post(`/listings/${listingId}/tenancies`, {
      tenantName: str(f, 'tenantName'),
      tenantPhone: str(f, 'tenantPhone'),
      startDate: str(f, 'startDate'),
      endDate: str(f, 'endDate'),
      monthlyRent: Number(str(f, 'monthlyRent')),
      paymentDay: Number(str(f, 'paymentDay')),
      deposit: deposit ? Number(deposit) : undefined,
      notes: str(f, 'notes') || undefined,
    }),
  );
  revalidatePath('/dashboard/listings');
  return res;
}

export async function endTenancyAction(listingId: string, tenancyId: string): Promise<void> {
  await termsCall(listingId, () => api.post(`/listings/tenancies/${tenancyId}/end`, {}));
  revalidatePath('/dashboard/listings');
}

export async function recordRentAction(listingId: string, tenancyId: string, period: string, _prev: ListingFormState, f: FormData): Promise<ListingFormState> {
  return termsCall(listingId, () =>
    api.post(`/listings/tenancies/${tenancyId}/payments`, {
      period,
      amount: Number(str(f, 'amount')),
      paidOn: str(f, 'paidOn'),
      note: str(f, 'note') || undefined,
    }),
  );
}

export async function removeRentPaymentAction(listingId: string, paymentId: string): Promise<void> {
  await termsCall(listingId, () => api.delete(`/listings/rent-payments/${paymentId}`));
}
